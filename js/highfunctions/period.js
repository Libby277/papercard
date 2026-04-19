/**
 * features/period.js - 月经记录系统
 * Period Tracker Module
 */

// ===== 数据加载 =====
async function initPeriodData() {
    try {
        const savedRecords = await localforage.getItem(getStorageKey('periodRecords'));
        if (savedRecords) {
            periodRecords = savedRecords.map(record => ({
                ...record,
                startDate: new Date(record.startDate),
                endDate: record.endDate ? new Date(record.endDate) : null,
                id: record.id || (Date.now() + Math.random()) 
            }));
        }
        
        const savedSettings = await localforage.getItem(getStorageKey('periodSettings'));
        if (savedSettings) {
            periodSettings = { ...periodSettings, ...savedSettings };
        }
        
        const savedCheckDate = await localforage.getItem(getStorageKey('lastPeriodReminderCheck'));
        if (savedCheckDate) {
            lastPeriodReminderCheck = savedCheckDate;
        }
    } catch (e) {
        console.error('Error loading period data:', e);
    }
}

// ===== 数据保存 =====
function savePeriodData() {
    try {
        localforage.setItem(getStorageKey('periodRecords'), periodRecords);
        localforage.setItem(getStorageKey('periodSettings'), periodSettings);
        if (lastPeriodReminderCheck) {
            localforage.setItem(getStorageKey('lastPeriodReminderCheck'), lastPeriodReminderCheck);
        }
    } catch (e) {
        console.error('Error saving period data:', e);
        if (e.name === 'QuotaExceededError') {
            showNotification('存储空间不足，建议清理一些旧记录', 'warning', 3000);
        }
    }
}

// ===== 每日提醒检查 =====
function checkDailyPeriodReminder() {
    const today = new Date().toDateString();
    
    if (lastPeriodReminderCheck === today) return;
    
    lastPeriodReminderCheck = today;
    localforage.setItem(getStorageKey('lastPeriodReminderCheck'), today);
    
    const message = getCycleMessageForReminder();
    
    if (message) {
        setTimeout(() => {
            showNotification(`${message}`, 'info', 6000);
        }, 4000);
    }
}


function getCycleMessageForReminder() {
    // 1. 安全检查：如果没有记录，直接返回
    if (periodRecords.length === 0) return null;

    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(latestRecord.startDate);
    startDate.setHours(0, 0, 0, 0);

    // 2. 获取用户自定义语句，如果不存在则使用空数组作为兜底
    // 注意：这里改为 periodCareMessages，与 config.js 保持一致
    const duringMsgs = (typeof periodCareMessages !== 'undefined' && periodCareMessages.during) ? periodCareMessages.during : [];
    const approachingMsgs = (typeof periodCareMessages !== 'undefined' && periodCareMessages.approaching) ? periodCareMessages.approaching : [];
    const delayedMsgs = (typeof periodCareMessages !== 'undefined' && periodCareMessages.delayed) ? periodCareMessages.delayed : [];

    // 月经期间
    if (latestRecord && !latestRecord.endDate) {
        if (duringMsgs.length > 0) {
            const randomIndex = Math.floor(Math.random() * duringMsgs.length);
            return `${settings.partnerName}：${duringMsgs[randomIndex]}`;
        }
        return null; // 用户没设置语句就不提醒
    }

    // 有结束日期的情况
    if (latestRecord.endDate) {
        const daysUntilNext = calculateDaysUntilNextPeriod();

        // 月经临近提醒（前3天）
        if (daysUntilNext !== null && daysUntilNext <= 3 && daysUntilNext > 0) {
            if (approachingMsgs.length > 0) {
                const randomIndex = Math.floor(Math.random() * approachingMsgs.length);
                return `${settings.partnerName}：${approachingMsgs[randomIndex]}`;
            }
        }

        // 月经推迟提醒
        if (daysUntilNext !== null && daysUntilNext <= 0) {
            if (delayedMsgs.length > 0) {
                const randomIndex = Math.floor(Math.random() * delayedMsgs.length);
                return `${settings.partnerName}：${delayedMsgs[randomIndex]}`;
            }
        }
    }
    return null;
}


// ===== 获取当前周期关怀话语 =====
// 修改 getCycleMessage 函数
function getCycleMessage() {
    const partnerName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
    
    if (typeof periodRecords === 'undefined' || periodRecords.length === 0) {
        return `${partnerName}：我会在这里守着你`;
    }
    
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(latestRecord.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    // 月经期间
    if (latestRecord && !latestRecord.endDate) {
        const messages = periodCareMessages.during;
        if (messages && messages.length > 0) {
            const randomIndex = Math.floor(Math.random() * messages.length);
            return `${partnerName}：${messages[randomIndex]}`;
        }
        return `${partnerName}：这几天要好好休息`;
    }
    
    if (latestRecord.endDate) {
        const daysUntilNext = calculateDaysUntilNextPeriod();
        
        // 月经临近
        if (daysUntilNext !== null && daysUntilNext <= 3 && daysUntilNext > 0) {
            const messages = periodCareMessages.approaching;
            if (messages && messages.length > 0) {
                const randomIndex = Math.floor(Math.random() * messages.length);
                return `${partnerName}：${messages[randomIndex]}`;
            }
            return `${partnerName}：特殊日子快来了，注意休息`;
        }
        
        // 月经推迟
        if (daysUntilNext !== null && daysUntilNext <= 0) {
            const messages = periodCareMessages.delayed;
            if (messages && messages.length > 0) {
                const randomIndex = Math.floor(Math.random() * messages.length);
                return `${partnerName}：${messages[randomIndex]}`;
            }
            return `${partnerName}：周期有点乱，最近累到了？`;
        }
    }
    
    return `${partnerName}：我会在这里守着你`;
}

// ===== 计算函数 =====
function calculatePeriodDuration(record) {
    if (!record.endDate) return 0;
    const start = new Date(record.startDate);
    const end = new Date(record.endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function calculateAverageCycleLength() {
    if (periodRecords.length < 2) {
        return periodSettings.averageCycleLength;
    }
    const completeRecords = periodRecords.filter(record => record.endDate);
    if (completeRecords.length < 2) {
        return periodSettings.averageCycleLength;
    }
    
    // 【修改】使用最近5次记录来计算平均周期，更贴近当前规律
    const recentRecords = [...completeRecords].sort((a, b) => b.startDate - a.startDate).slice(0, 5);
    const sortedRecords = [...recentRecords].sort((a, b) => a.startDate - b.startDate);
    
    let totalDays = 0;
    let cycleCount = 0;
    for (let i = 1; i < sortedRecords.length; i++) {
        const currentStart = new Date(sortedRecords[i].startDate);
        const previousStart = new Date(sortedRecords[i - 1].startDate);
        const cycleLength = Math.ceil((currentStart - previousStart) / (1000 * 60 * 60 * 24));
        if (cycleLength >= 20 && cycleLength <= 45) {  // 只计算合理范围内的周期
            totalDays += cycleLength;
            cycleCount++;
        }
    }
    
    if (cycleCount > 0) {
        const average = Math.round(totalDays / cycleCount);
        periodSettings.averageCycleLength = average;
        savePeriodData();
        return average;
    }
    return periodSettings.averageCycleLength;
}


function calculateDaysUntilNextPeriod() {
    if (periodRecords.length === 0) return null;
    const completeRecords = periodRecords.filter(record => record.endDate);
    if (completeRecords.length === 0) return null;
    
    const sortedRecords = [...completeRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    
    // 获取最新的平均周期
    const averageCycle = calculateAverageCycleLength();
    
    // 【改进】如果记录较少，使用更保守的预测
    if (completeRecords.length < 3) {
        // 使用默认周期或最近一次周期的 ±3天范围
        const variation = Math.min(3, Math.floor(averageCycle * 0.1)); // 最多±10%
        return Math.ceil((latestRecord.startDate - new Date()) / (1000 * 60 * 60 * 24)) + averageCycle;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextPeriodDate = new Date(latestRecord.startDate);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycle);
    
    return Math.ceil((nextPeriodDate - today) / (1000 * 60 * 60 * 24));
}


// ===== 格式化日期 =====
function formatPeriodDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ===== 更新界面 =====
function updatePeriodUI() {
    updatePeriodCurrentStatus();
    updatePeriodStatistics();
    updatePeriodHistoryList();
    updatePeriodCycleMessage();
}

function updatePeriodCurrentStatus() {
    const statusElement = document.getElementById('period-current-status');
    if (!statusElement) return;
    
    if (periodRecords.length === 0) {
        statusElement.textContent = '未记录';
        statusElement.style.color = 'var(--text-secondary)';
        return;
    }
    
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    const latestRecord = sortedRecords[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(latestRecord.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    if (!latestRecord.endDate) {
        // 月经期间
        const dayOfCycle = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
        statusElement.textContent = `经期第${dayOfCycle}天`;
        statusElement.style.color = '#e91e63';
    } else {
        const endDate = new Date(latestRecord.endDate);
        endDate.setHours(0, 0, 0, 0);
        
        const daysSince = Math.ceil((today - endDate) / (1000 * 60 * 60 * 24));
        const averageCycle = calculateAverageCycleLength();
        const nextPeriodDate = new Date(latestRecord.startDate);
        nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycle);
        
        if (today < nextPeriodDate) {
            const daysUntilNext = Math.ceil((nextPeriodDate - today) / (1000 * 60 * 60 * 24));
            statusElement.textContent = `已结束${daysSince}天，预计${daysUntilNext}天后`;
            statusElement.style.color = 'var(--accent-color)';
        } else {
            const daysDelayed = Math.ceil((today - nextPeriodDate) / (1000 * 60 * 60 * 24));
            statusElement.textContent = `已结束${daysSince}天，推迟${daysDelayed}天`;
            statusElement.style.color = '#ff9800';
        }
    }
}

function updatePeriodStatistics() {
    const durationEl = document.getElementById('period-duration');
    const cycleEl = document.getElementById('period-cycle-length');
    const nextEl = document.getElementById('period-days-until-next');
    
    if (periodRecords.length === 0) {
        if (durationEl) durationEl.textContent = '-';
        if (cycleEl) cycleEl.textContent = '-';
        if (nextEl) nextEl.textContent = '-';
        return;
    }
    
    const averageCycle = calculateAverageCycleLength();
    if (cycleEl) cycleEl.textContent = `${averageCycle}天`;
    
    const daysUntilNext = calculateDaysUntilNextPeriod();
    if (nextEl) nextEl.textContent = daysUntilNext !== null ? `${daysUntilNext}天` : '-';
    
    const completeRecords = periodRecords.filter(record => record.endDate);
    if (completeRecords.length > 0 && durationEl) {
        const sortedCompleteRecords = [...completeRecords].sort((a, b) => b.startDate - a.startDate);
        const latestCompleteRecord = sortedCompleteRecords[0];
        const duration = calculatePeriodDuration(latestCompleteRecord);
        durationEl.textContent = `${duration}天`;
    } else if (durationEl) {
        durationEl.textContent = '-';
    }
}

function updatePeriodHistoryList() {
    const historyList = document.getElementById('period-history-list');
    if (!historyList) return;
    
    if (periodRecords.length === 0) {
        historyList.innerHTML = `
            <div class="period-empty-state">
                <i class="fas fa-calendar-plus"></i>
                <p>暂无记录</p>
                <span>开始记录你的月经周期吧</span>
            </div>
        `;
        return;
    }
    
    const sortedRecords = [...periodRecords].sort((a, b) => b.startDate - a.startDate);
    
    let historyHTML = '';
    sortedRecords.forEach((record, index) => {
        const startDateStr = formatPeriodDate(record.startDate);
        const isActive = !record.endDate;
        
        if (isActive) {
            const dayOfCycle = Math.ceil((new Date() - record.startDate) / (1000 * 60 * 60 * 24)) + 1;
            historyHTML += `
                <div class="period-history-item" data-index="${index}">
                    <div class="period-history-dates">
                        <div class="period-history-range">${startDateStr} - 进行中</div>
                        <div class="period-history-duration">第${dayOfCycle}天</div>
                    </div>
                    <button class="period-history-delete" title="删除记录" onclick="deletePeriodRecord(${record.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        } else {
            const endDateStr = formatPeriodDate(record.endDate);
            const duration = calculatePeriodDuration(record);
            historyHTML += `
                <div class="period-history-item" data-index="${index}">
                    <div class="period-history-dates">
                        <div class="period-history-range">${startDateStr} - ${endDateStr}</div>
                        <div class="period-history-duration">持续 ${duration} 天</div>
                    </div>
                    <button class="period-history-delete" title="删除记录" onclick="deletePeriodRecord(${record.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
    });
    
    historyList.innerHTML = historyHTML;
}

function updatePeriodCycleMessage() {
    const messageElement = document.getElementById('period-random-message');
    if (!messageElement) return;
    
    const message = getCycleMessage();
    messageElement.innerHTML = `<i class="fas fa-heart" style="color: #e91e63; margin-right: 8px;"></i>${message}`;
}

// ===== 记录操作 =====
function startPeriodRecord() {
    const startDateInput = document.getElementById('period-start-date');
    const startDate = startDateInput ? startDateInput.value : null;
    
    if (!startDate) {
        showNotification('请选择开始日期', 'warning', 3000);
        return;
    }
    
    const start = new Date(startDate);
    
    // 检查是否有进行中的记录
    const hasActivePeriod = periodRecords.some(record => !record.endDate);
    if (hasActivePeriod) {
        showNotification('已有进行中的月经记录，请先结束当前记录', 'warning', 3000);
        return;
    }
    
    const newRecord = {
        id: Date.now(),
        startDate: start,
        endDate: null,
        createdAt: new Date()
    };
    
    periodRecords.push(newRecord);
    savePeriodData();
    
    updatePeriodUI();
    showNotification('月经开始记录已保存', 'success', 2000);
}

function endPeriodRecord() {
    const endDateInput = document.getElementById('period-end-date');
    const endDate = endDateInput ? endDateInput.value : null;
    
    if (!endDate) {
        showNotification('请选择结束日期', 'warning', 3000);
        return;
    }
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);  // 🆕 统一为本地时间 00:00:00
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (end > today) {
        showNotification('结束日期不能晚于今天', 'error', 3000);
        return;
    }
    
    const activeRecordIndex = periodRecords.findIndex(record => !record.endDate);
    if (activeRecordIndex === -1) {
        showNotification('没有找到进行中的月经记录', 'warning', 3000);
        return;
    }
    
    const startDate = new Date(periodRecords[activeRecordIndex].startDate);
    if (end < startDate) {
        showNotification('结束日期不能早于开始日期', 'error', 3000);
        return;
    }
    
    periodRecords[activeRecordIndex].endDate = end;
    savePeriodData();
    
    updatePeriodUI();
    
    const duration = calculatePeriodDuration(periodRecords[activeRecordIndex]);
    showNotification(`月经结束记录已保存，本次持续${duration}天`, 'success', 3000);
}

window.deletePeriodRecord = function(id) {
    if (confirm('确定要删除这条记录吗？')) {
        // 通过 ID 查找记录的索引
        const index = periodRecords.findIndex(record => record.id === id);
        
        if (index !== -1) {
            periodRecords.splice(index, 1);
            savePeriodData();
            updatePeriodUI();
            showNotification('记录已删除', 'success', 2000);
        }
    }
};

// ===== 打开月经模态框 =====
function openPeriodModal() {
    const advModal = document.getElementById('advanced-modal');
    if (advModal) hideModal(advModal);
    
    const periodModal = document.getElementById('period-modal');
    setTimeout(() => {
        updatePeriodUI();
        
        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        const startInput = document.getElementById('period-start-date');
        const endInput = document.getElementById('period-end-date');
        if (startInput) startInput.value = today;
        if (endInput) endInput.value = today;
        
        showModal(periodModal);
    }, 150);
}

// ================== 限时字卡池：核心判定逻辑 ==================

/**
 * 判断当前处于什么阶段
 * 返回值：'approaching'(临近), 'during'(经期), 'delayed'(推迟), 或 null(平时)
 */
function getCurrentPeriodPhase() {
    // 0. 没有记录或者没有设置文案，直接隐身
    if (!periodRecords || periodRecords.length === 0) return null;
    if (typeof periodCareMessages === 'undefined') return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. 检查是否处于“经期中”（有未结束的记录）
    const activeRecord = periodRecords.find(r => !r.endDate);
    if (activeRecord) {
        return 'during';
    }

    // 2. 计算距离预测日的天数
    const daysUntilNext = calculateDaysUntilNextPeriod();
    
    // 如果无法计算（比如记录太少没有完整的结束日期），返回 null
    if (daysUntilNext === null) return null;

    // 3. 检查是否处于“临近期”（预测日的前 1 到 7 天）
    if (daysUntilNext >= 1 && daysUntilNext <= 7) {
        return 'approaching';
    }

    // 4. 检查是否处于“推迟期”（逾期 1 到 7 天内）
    if (daysUntilNext <= 0 && daysUntilNext >= -7) {
        return 'delayed';
    }

    // 5. 其他时间，彻底隐身
    return null;
}

/**
 * 获取当前阶段应该激活的关怀文案数组
 * 平时返回空数组，特殊时期返回对应文案
 */
function getActiveCareMessages() {
    const phase = getCurrentPeriodPhase();
    if (!phase) return []; // 平时直接给空数组，什么都不加
    
    const msgs = periodCareMessages[phase];
    return Array.isArray(msgs) ? msgs : [];
}

// ===== 初始化监听器 =====
function initPeriodListeners() {
    // 入口按钮
    const entryBtn = document.getElementById('period-function');
    if (entryBtn && !entryBtn.dataset.initialized) {
        entryBtn.dataset.initialized = 'true';
        entryBtn.addEventListener('click', openPeriodModal);
    }
    
    // 关闭按钮
    const closeBtn = document.getElementById('close-period');
    if (closeBtn && !closeBtn.dataset.initialized) {
        closeBtn.dataset.initialized = 'true';
        closeBtn.addEventListener('click', () => {
            hideModal(document.getElementById('period-modal'));
        });
    }
    
    // 开始记录按钮
    const startBtn = document.getElementById('start-period-record');
    if (startBtn && !startBtn.dataset.initialized) {
        startBtn.dataset.initialized = 'true';
        startBtn.addEventListener('click', startPeriodRecord);
    }
    
    // 结束记录按钮
    const endBtn = document.getElementById('end-period-record');
    if (endBtn && !endBtn.dataset.initialized) {
        endBtn.dataset.initialized = 'true';
        endBtn.addEventListener('click', endPeriodRecord);
    }
    
    // 设置日期输入的最大值为今天
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('period-start-date');
    const endInput = document.getElementById('period-end-date');
    if (startInput) startInput.max = today;
    if (endInput) endInput.max = today;
    
    // 检查每日提醒
   // setTimeout(checkDailyPeriodReminder, 5000);
}

// 导出函数供其他模块调用
window.initPeriodData = initPeriodData;
window.initPeriodListeners = initPeriodListeners;
