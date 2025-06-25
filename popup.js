// 工具函数：格式化速率
function formatSpeed(bytes) {
  if (bytes > 1024*1024) return (bytes/1024/1024).toFixed(1) + ' MB/s';
  if (bytes > 1024) return (bytes/1024).toFixed(1) + ' KB/s';
  return bytes + ' B/s';
}

// 读取设置
function loadSettings(callback) {
  chrome.storage.local.get(["ip", "port", "token"], function(data) {
    callback(data.ip || '', data.port || '', data.token || '');
  });
}

// 保存设置
function saveSettings() {
  const ip = document.getElementById("ip").value.trim();
  const port = document.getElementById("port").value.trim();
  const token = document.getElementById("token").value.trim();
  chrome.storage.local.set({ ip, port, token }, function() {
    showSettingsMsg("设置已保存", false);
    setTimeout(() => {
      document.getElementById('settings-modal').classList.remove('active');
      connectAllWS(ip, port, token);
    }, 600);
  });
}

// 显示主界面消息
function showMsg(msg, isError = false) {
  const el = document.getElementById("msg");
  el.textContent = msg;
  el.style.color = isError ? "#d9534f" : "#28a745";
}
// 显示设置弹窗消息
function showSettingsMsg(msg, isError = false) {
  const el = document.getElementById("settings-msg");
  el.textContent = msg;
  el.style.color = isError ? "#d9534f" : "#28a745";
}

// WebSocket 实时数据
let wsTraffic, wsMemory, wsConnections;

// ECharts流量图逻辑
let trafficChart = null;
let trafficData = {
  up: [], // {name: 时间, value: 上行字节/秒}
  down: [] // {name: 时间, value: 下行字节/秒}
};
function formatSpeedAuto(bytes) {
  if (bytes > 1024*1024) return (bytes/1024/1024).toFixed(2) + ' MB/s';
  if (bytes > 1024) return (bytes/1024).toFixed(2) + ' KB/s';
  return bytes + ' B/s';
}
function initTrafficChart() {
  const chartDom = document.getElementById('traffic-chart');
  if (!chartDom) return;
  trafficChart = echarts.init(chartDom);
  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        let html = '';
        params.forEach(item => {
          html += `<div class=\"flex items-center my-2 gap-1\">` +
            `<div class=\"w-4 h-4 rounded-full\" style=\"background-color:${item.color};display:inline-block;\"></div> ` +
            `${item.seriesName} (${item.data.name}): ${formatSpeedAuto(item.data.value)}</div>`;
        });
        return html;
      },
      backgroundColor: 'rgba(40,48,60,0.92)',
      borderColor: 'rgba(60,72,88,0.18)',
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      extraCssText: 'box-shadow:0 4px 24px 0 rgba(60,72,88,0.18);font-family:MiSans,NotoEmoji,system-ui;font-size:15px;color:#fff;',
      textStyle: { color: '#fff', fontSize: 15, fontFamily: 'MiSans,NotoEmoji,system-ui' }
    },
    grid: { left: 35, right: 10, top: 10, bottom: 10 },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: { color: '#888', fontSize: 12, margin: 16 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: '#888',
        fontSize: 11,
        margin: 12,
        formatter: function(val) {
          if (val >= 1024*1024) return (val/1024/1024).toFixed(1) + ' MB/s';
          if (val >= 1024) return (val/1024).toFixed(1) + ' KB/s';
          return val + ' B/s';
        }
      },
      splitLine: { show: true, lineStyle: { type: 'dashed', color: '#eee' } },
      splitNumber: 5
    },
    series: [
      {
        name: '上传速度',
        type: 'line',
        data: [],
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#6366f1', width: 2 },
        areaStyle: { color: 'rgba(99,102,241,0.10)' }
      },
      {
        name: '下载速度',
        type: 'line',
        data: [],
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#f59e42', width: 2 },
        areaStyle: { color: 'rgba(245,158,66,0.10)' }
      }
    ]
  };
  trafficChart.setOption(option);
}
function updateTrafficChart(up, down) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString().replace(/^\d+:/, '');
  if (trafficData.up.length >= 60) trafficData.up.shift();
  if (trafficData.down.length >= 60) trafficData.down.shift();
  trafficData.up.push({ name: timeLabel, value: up });
  trafficData.down.push({ name: timeLabel, value: down });

  // 计算最大值
  const allVals = trafficData.up.concat(trafficData.down).map(d => d.value);
  let maxVal = Math.max(...allVals, 1);

  // 计算合适的单位和间隔
  let interval, unit;
  if (maxVal >= 1024*1024) {
    interval = Math.ceil(maxVal / 5 / 1024 / 1024) * 1024 * 1024;
    unit = 'MB/s';
  } else if (maxVal >= 1024) {
    interval = Math.ceil(maxVal / 5 / 1024) * 1024;
    unit = 'KB/s';
  } else {
    interval = Math.ceil(maxVal / 5) || 1;
    unit = 'B/s';
  }
  const yMax = interval * 5;

  if (trafficChart) {
    trafficChart.setOption({
      xAxis: { data: trafficData.up.map(d => d.name) },
      yAxis: {
        max: yMax,
        interval: interval,
        axisLabel: {
          formatter: function(val) {
            // 只在最大刻度显示单位，其余为空
            if (val === yMax) return unit;
            return '';
          },
          color: '#888',
          fontSize: 11,
          margin: 12
        }
      },
      series: [
        { data: trafficData.up },
        { data: trafficData.down }
      ]
    });
  }
}

function connectTrafficWS(ip, port, token) {
  if (wsTraffic) wsTraffic.close();
  wsTraffic = new WebSocket(`ws://${ip}:${port}/traffic?token=${token}`);
  wsTraffic.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      document.getElementById('ul-speed').textContent = data.up !== undefined ? formatSpeed(data.up) : '--';
      document.getElementById('dl-speed').textContent = data.down !== undefined ? formatSpeed(data.down) : '--';
      if (typeof data.up === 'number' && typeof data.down === 'number') {
        updateTrafficChart(data.up, data.down);
      }
    } catch (e) {
      document.getElementById('ul-speed').textContent = '--';
      document.getElementById('dl-speed').textContent = '--';
    }
  };
  wsTraffic.onerror = function() {
    document.getElementById('ul-speed').textContent = '--';
    document.getElementById('dl-speed').textContent = '--';
  };
}

function connectMemoryWS(ip, port, token) {
  if (wsMemory) wsMemory.close();
  wsMemory = new WebSocket(`ws://${ip}:${port}/memory?token=${token}`);
  wsMemory.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      document.getElementById('mem').textContent = data.inuse !== undefined
        ? `${(data.inuse/1024/1024).toFixed(1)}MB` + (data.oslimit ? ` / ${(data.oslimit/1024/1024).toFixed(1)}MB` : '')
        : '--';
    } catch (e) {
      document.getElementById('mem').textContent = '--';
    }
  };
  wsMemory.onerror = function() {
    document.getElementById('mem').textContent = '--';
  };
}

function connectConnectionsWS(ip, port, token) {
  if (wsConnections) wsConnections.close();
  wsConnections = new WebSocket(`ws://${ip}:${port}/connections?token=${token}`);
  wsConnections.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      if (Array.isArray(data.connections)) {
        document.getElementById('conn-count').textContent = data.connections.length;
      } else if (Array.isArray(data)) {
        document.getElementById('conn-count').textContent = data.length;
    } else {
        document.getElementById('conn-count').textContent = '--';
      }
    } catch (e) {
      document.getElementById('conn-count').textContent = '--';
    }
  };
  wsConnections.onerror = function() {
    document.getElementById('conn-count').textContent = '--';
  };
}

function connectAllWS(ip, port, token) {
  if (!ip || !port || !token) {
    showMsg('请先设置路由器信息', true);
    document.getElementById('conn-count').textContent = '--';
    document.getElementById('ul-speed').textContent = '--';
    document.getElementById('dl-speed').textContent = '--';
    document.getElementById('mem').textContent = '--';
        return;
    }
  showMsg('');
  connectTrafficWS(ip, port, token);
  connectMemoryWS(ip, port, token);
  connectConnectionsWS(ip, port, token);
}

function closeAllWS() {
  if (wsTraffic) wsTraffic.close();
  if (wsMemory) wsMemory.close();
  if (wsConnections) wsConnections.close();
}

// 设置弹窗逻辑
function openSettings() {
  loadSettings((ip, port, token) => {
    document.getElementById("ip").value = ip;
    document.getElementById("port").value = port;
    document.getElementById("token").value = token;
    document.getElementById('settings-modal').classList.add('active');
    showSettingsMsg('');
  });
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('active');
}

document.getElementById("open-settings").onclick = openSettings;
document.getElementById("close-settings").onclick = closeSettings;
document.getElementById("save").onclick = saveSettings;
document.getElementById("reset").onclick = function() {
  loadSettings((ip, port, token) => {
    if (!ip || !port || !token) {
      showMsg("请先设置路由器信息", true);
        return;
    }
    showMsg("正在发送重置请求...");
    fetch(`http://${ip}:${port}/connections`, {
      method: "DELETE",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "authorization": `Bearer ${token}`,
        "cache-control": "no-cache",
        "pragma": "no-cache"
      },
      referrer: `http://${ip}:${port}/ui/zashboard/`,
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      mode: "cors",
      credentials: "include"
    }).then(res => {
      if (res.ok) {
        showMsg("重置请求已发送，等待路由器响应");
        } else {
        showMsg("请求失败，状态码：" + res.status, true);
      }
    }).catch(e => {
      showMsg("请求异常：" + e.message, true);
        });
    });
};

// 页面加载时自动连接WebSocket
window.onload = function() {
  loadSettings((ip, port, token) => {
    connectAllWS(ip, port, token);
    });
};
window.onunload = closeAllWS;

// 主题切换逻辑
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('router-theme', theme);
  var icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
window.addEventListener('DOMContentLoaded', function() {
  let theme = localStorage.getItem('router-theme');
  if (!theme) theme = detectSystemTheme();
  setTheme(theme);

  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.onclick = function() {
      let current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    };
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('router-theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });

  initTrafficChart();
});

// 连接详情弹窗逻辑
function renderConnList(connections) {
  const list = document.getElementById('conn-list');
  if (!list) return;
  if (!connections || !connections.length) {
    list.innerHTML = '<div style="text-align:center;color:#888;">暂无连接</div>';
    return;
  }
  list.innerHTML = connections.map(conn => {
    const host = conn.metadata && conn.metadata.host ? conn.metadata.host : (conn.metadata && conn.metadata.destinationIP ? conn.metadata.destinationIP : '--');
    // chains 优先取第二个（index 1），没有则取第一个，没有则显示0
    let chainStr = '0';
    if (Array.isArray(conn.chains) && conn.chains.length > 0) {
      chainStr = conn.chains[1] || conn.chains[0] || '0';
    }
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
      <div style=\"flex:1;display:flex;align-items:center;overflow:hidden;\">
        <span style=\"color:#6366f1;font-weight:500;max-width:70%;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">${host}</span>
        <span style=\"color:#888;font-size:13px;margin-left:8px;flex-shrink:0;\">${chainStr}</span>
      </div>
      <button class=\"close-conn-btn\" data-id=\"${conn.id}\" style=\"background:none;border:none;color:#d9534f;font-size:18px;cursor:pointer;\">✖</button>
    </div>`;
  }).join('');
}

function openConnModal() {
  document.getElementById('conn-modal').style.display = 'flex';
  loadSettings((ip, port, token) => {
    fetch(`http://${ip}:${port}/connections`, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      let conns = Array.isArray(data.connections) ? data.connections : (Array.isArray(data) ? data : []);
      renderConnList(conns);
    })
    .catch(() => {
      renderConnList([]);
    });
  });
}

function closeConnModal() {
  document.getElementById('conn-modal').style.display = 'none';
}

document.getElementById('conn-detail-btn').onclick = openConnModal;
document.getElementById('close-conn-modal').onclick = closeConnModal;
document.body.addEventListener('click', function(e) {
  if (e.target.classList.contains('close-conn-btn')) {
    const id = e.target.getAttribute('data-id');
    loadSettings((ip, port, token) => {
      fetch(`http://${ip}:${port}/connections/${id}`, {
        method: 'DELETE',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'authorization': `Bearer ${token}`
        }
      }).then(() => {
        // 删除后刷新列表
        openConnModal();
      });
    });
  }
}); 