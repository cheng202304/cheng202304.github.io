document.addEventListener('DOMContentLoaded', function() {
    // 显示启动动画
    const startAnimation = document.getElementById('start-animation');
    const container = document.querySelector('.container');
    
    // 启动动画结束后显示主界面
    setTimeout(() => {
        startAnimation.style.opacity = '0';
        setTimeout(() => {
            startAnimation.style.display = 'none';
            container.style.display = 'block';
        }, 500);
    }, 2000);
    // 初始化数据
    let records = [];
    let editingId = null;
    let settings = {
        classes: [],
        courses: [],
        types: []
    };

    let chartInstance = null;
    // 在全局变量部分添加
    let currentPage = 1;
    const recordsPerPage = 10; // 每页显示10条记录
    
    // DOM元素
    const dateInput = document.getElementById('date');
    const sessionInput = document.getElementById('session');
    const classInput = document.getElementById('class');
    const courseInput = document.getElementById('course');
    const typeInput = document.getElementById('type');
    const saveBtn = document.getElementById('save-btn');
    const recordsList = document.getElementById('records-list');
    
    // 设置相关DOM元素
    const newClassInput = document.getElementById('new-class');
    const addClassBtn = document.getElementById('add-class');
    const classList = document.getElementById('class-list');
    const newCourseInput = document.getElementById('new-course');
    const addCourseBtn = document.getElementById('add-course');
    const courseList = document.getElementById('course-list');
    const newTypeInput = document.getElementById('new-type');
    const addTypeBtn = document.getElementById('add-type');
    const typeList = document.getElementById('type-list');
    const saveSettingsBtn = document.getElementById('save-settings');
    
    // 标签页相关
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // 统计相关DOM元素
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const statClassInput = document.getElementById('stat-class');
    const generateStatBtn = document.getElementById('generate-stat');
    const statisticsSummary = document.getElementById('statistics-summary');
    const statisticsDetails = document.getElementById('statistics-details');
    const statNotesInput = document.getElementById('stat-notes');
    const exportExcelBtn = document.getElementById('export-excel');
    const exportPdfBtn = document.getElementById('export-pdf');
    
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    
    // 初始化应用
    initApp();
    
    // 关闭网页按钮
    document.getElementById('close-btn').addEventListener('click', function() {
           try {
                 if (window.android && typeof window.android.closeApp === 'function') {
                     window.android.closeApp(); // 调用Android接口
                 } else {
                     alert('请在App内使用此功能');
                 }
             } catch (e) {
                 console.error('JS接口调用失败:', e);
             }

           window.close();
    });
    
    // 备份数据
    document.getElementById('backup-btn').addEventListener('click', function() {
        const data = localStorage.getItem('classRecords');
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'class_records_backup_' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        
        document.getElementById('backup-status').textContent = '备份成功！';
        setTimeout(() => {
            document.getElementById('backup-status').textContent = '';
        }, 3000);
    });
    
    // 还原数据
    document.getElementById('restore-btn').addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = event => {
                try {
                    const data = JSON.parse(event.target.result);
                    localStorage.setItem('classRecords', JSON.stringify(data));
                    document.getElementById('backup-status').textContent = '还原成功！';
                    setTimeout(() => {
                        document.getElementById('backup-status').textContent = '';
                        location.reload();
                    }, 3000);
                } catch (error) {
                    document.getElementById('backup-status').textContent = '文件格式错误！';
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    });
    

    
    // 标签页切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 更新内容显示
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // 初始化应用
    function initApp() {
        loadData();
        loadSettings();
        initCharts();


        
        // 保存按钮事件
        saveBtn.addEventListener('click', function() {
            saveRecord();
        });
        
        // 设置相关事件
        addClassBtn.addEventListener('click', () => addSettingItem('classes', newClassInput));
        addCourseBtn.addEventListener('click', () => addSettingItem('courses', newCourseInput));
        addTypeBtn.addEventListener('click', () => addSettingItem('types', newTypeInput));
        saveSettingsBtn.addEventListener('click', function() {
            saveSettings();
        });
        
        // 回车键添加项目
        newClassInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addSettingItem('classes', newClassInput);
        });
        newCourseInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addSettingItem('courses', newCourseInput);
        });
        newTypeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addSettingItem('types', newTypeInput);
        });

         // 初始化统计页面
        initStatistics();
        initCharts();
    }
    
    // 加载数据
    function loadData() {
        loadDataFromAndroid((savedData) => {
            try {
                records = JSON.parse(savedData);
                if (!Array.isArray(records)) {
                    records = [];
                }  
                renderRecords();
            } catch (e) {
                console.error("Error parsing data:", e);
                records = [];
                renderRecords();
            }
        });
    }
    
    // 加载设置
    function loadSettings() {
        loadSettingsFromAndroid((savedSettings) => {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                if (parsedSettings && 
                    Array.isArray(parsedSettings.classes) && 
                    Array.isArray(parsedSettings.courses) && 
                    Array.isArray(parsedSettings.types)) {
                    settings = parsedSettings;
                } else {
                    // 默认设置
                    settings = {
                        classes: ["23对口计算机", "23春电子商务", "24春电子商务", "23秋电子商务一"],
                        courses: ["网页设计", "网站建设与维护", "计算机网络技术", "计算机应用基础"],
                        types: ["理论课", "实训课", "复习课"]
                    };
                }
                renderSettings();
                updateFormOptions();
            } catch (e) {
                console.error("Error parsing settings:", e);
                // 默认设置
                settings = {
                    classes: ["23对口计算机", "23春电子商务", "24春电子商务", "23秋电子商务一"],
                    courses: ["网页设计", "网站建设与维护", "计算机网络技术", "计算机应用基础"],
                    types: ["理论课", "实训课", "复习课"]
                };
                renderSettings();
                updateFormOptions();
            }
        });
    }
    
    // 渲染设置项
    function renderSettings() {
        renderSettingList('classes', classList);
        renderSettingList('courses', courseList);
        renderSettingList('types', typeList);
    }
    
    // 渲染单个设置列表
    function renderSettingList(settingKey, listElement) {
        listElement.innerHTML = '';
        settings[settingKey].forEach((item, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item}</span>
                <button class="delete-setting" data-type="${settingKey}" data-index="${index}">删除</button>
            `;
            listElement.appendChild(li);
        });
        
        // 添加删除事件
        listElement.querySelectorAll('.delete-setting').forEach(btn => {
            btn.addEventListener('click', deleteSettingItem);
        });
    }
    
    // 更新表单选项
    function updateFormOptions() {
        updateSelectOptions(classInput, settings.classes);
        updateSelectOptions(courseInput, settings.courses);
        updateSelectOptions(typeInput, settings.types);
    }
    
    // 更新选择框选项
    function updateSelectOptions(selectElement, options) {
        // 保存当前选中的值
        const selectedValue = selectElement.value;
        
        // 清空并重新填充选项
        selectElement.innerHTML = '<option value="">请选择</option>';
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            selectElement.appendChild(opt);
        });
        
        // 恢复选中的值（如果还存在）
        if (options.includes(selectedValue)) {
            selectElement.value = selectedValue;
        }
    }
    
    // 添加设置项
    function addSettingItem(settingKey, inputElement) {
        const value = inputElement.value.trim();
        if (value && !settings[settingKey].includes(value)) {
            settings[settingKey].push(value);
            inputElement.value = '';
            renderSettings();
            updateFormOptions();
        }
    }
    
    // 删除设置项
    async function deleteSettingItem(e) {
        const settingKey = e.target.getAttribute('data-type');
        const index = parseInt(e.target.getAttribute('data-index'));
        
        try {
            const confirmed = await DialogBridge.confirm("确定要删除此项吗？");
            if (confirmed) {
                settings[settingKey].splice(index, 1);
                renderSettings();
                updateFormOptions();
                
                // 检查是否有记录使用了被删除的项
                checkRecordsAfterDeletion(settingKey, index);
            }
        } catch (err) {
            console.error("弹窗出错:", err);
        }
    }
    
    // 检查记录是否需要更新
    function checkRecordsAfterDeletion(settingKey, deletedIndex) {
        const deletedItem = settings[settingKey][deletedIndex];
        
        records.forEach(record => {
            if (settingKey === 'classes' && record.class === deletedItem) {
                record.class = '';
            } else if (settingKey === 'courses' && record.course === deletedItem) {
                record.course = '';
            } else if (settingKey === 'types' && record.type === deletedItem) {
                record.type = '';
            }
        });
        
        saveToLocal();
        renderRecords();
    }
    
    // 保存设置
    function saveSettings() {
        saveSettingsToAndroid(JSON.stringify(settings));
        DialogBridge.alert("设置已保存");
    }
    
    // 修改 saveRecord 函数，保存后重置到第一页
    function saveRecord() {
    // 验证输入
    if (!dateInput.value || !sessionInput.value || !classInput.value || !courseInput.value || !typeInput.value) {
        DialogBridge.alert('请填写所有字段');
        return;
    }
    
    const record = {
        id: editingId || Date.now(),
        date: dateInput.value,
        session: sessionInput.value,
        class: classInput.value,
        course: courseInput.value,
        type: typeInput.value
    };
    
    if (editingId) {
        // 更新现有记录
        const index = records.findIndex(r => r.id === editingId);
        if (index !== -1) {
            records[index] = record;
        }
        editingId = null;
        saveBtn.textContent = '保存记录';
    } else {
        // 添加新记录
        records.push(record);
        // 新增记录后显示第一页
        currentPage = 1;
    }
    
    // 保存并刷新
    saveToLocal();
    renderRecords();
    resetForm();
    }
    
    // 保存到本地
    function saveToLocal() {
        saveDataToAndroid(JSON.stringify(records));
    }
    
    // 修改 renderRecords 函数
    function renderRecords() {
    recordsList.innerHTML = '';
    if (records.length === 0) {
        recordsList.innerHTML = '<p>暂无记录</p>';
        return;
    }
    
    // 按登记时间倒序排序（id是时间戳，大的排在前面）
    records.sort((a, b) => b.id - a.id);
    
    // 计算总页数
    const totalPages = Math.ceil(records.length / recordsPerPage);
    
    // 确保当前页在有效范围内
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    // 获取当前页的记录
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, records.length);
    const currentRecords = records.slice(startIndex, endIndex);
    
    // 渲染当前页记录
    currentRecords.forEach(record => {
        const recordElement = document.createElement('div');
        recordElement.className = 'record-item';
        recordElement.innerHTML = `
            <div class="record-info">
                <p><strong>日期：</strong>${record.date} <strong>节次：</strong>${record.session}</p>
                <p><strong>班级：</strong>${record.class} <strong>课程：</strong>${record.course}</p>
                <p><strong>课型：</strong>${record.type}</p>
            </div>
            <div class="record-actions">
                <button class="edit" data-id="${record.id}">编辑</button>
                <button class="delete" data-id="${record.id}">删除</button>
            </div>
        `;
        recordsList.appendChild(recordElement);
    });
    
    // 添加分页控件
    if (totalPages > 1) {
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        
        // 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '上一页';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            currentPage--;
            renderRecords();
        });
        
        // 页码信息
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
        
        // 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '下一页';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            currentPage++;
            renderRecords();
        });
        
        pagination.appendChild(prevBtn);
        pagination.appendChild(pageInfo);
        pagination.appendChild(nextBtn);
        recordsList.appendChild(pagination);
    }
    
    // 添加删除和编辑事件
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', deleteRecord);
    });
    
    document.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', editRecord);
    });
    }

    // 删除记录
    async function deleteRecord(e) {
        const id = parseInt(e.target.getAttribute('data-id'));
        try {
            const confirmed = await DialogBridge.confirm("确定要删除这条记录吗？"); 
            if (confirmed) {
                records = records.filter(record => record.id !== id);
                saveToLocal();
                renderRecords();
            }
        } catch (err) {
            console.error("弹窗出错:", err);
        }
    }
    
    // 编辑记录
    function editRecord(e) {
        const id = parseInt(e.target.getAttribute('data-id'));
        const record = records.find(r => r.id === id);
        
        if (record) {
            dateInput.value = record.date;
            sessionInput.value = record.session;
            classInput.value = record.class;
            courseInput.value = record.course;
            typeInput.value = record.type;
            
            editingId = id;
            saveBtn.textContent = '更新记录';
            
            // 滚动到表单
            document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // 重置表单
    function resetForm() {
        dateInput.value = today;
        sessionInput.value = '';
        classInput.value = '';
        courseInput.value = '';
        typeInput.value = '';
    }

// 设置默认日期范围（本月）
function setDefaultDateRange() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    startDateInput.value = firstDay.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
}
// 初始化统计页面
function initStatistics() {
    setDefaultDateRange();
    updateSelectOptions(statClassInput, settings.classes, true);
    
    generateStatBtn.addEventListener('click', function() {
            generateStatistics();
        });
    exportExcelBtn.addEventListener('click', exportToExcel);
    exportPdfBtn.addEventListener('click', exportToPdf);
}

function getFilteredRecords(timeRange) {
    // 根据时间范围过滤记录
    const today = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
        case 'week':
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(today.getMonth() - 1);
            break;
        case 'year':
            startDate.setFullYear(today.getFullYear() - 1);
            break;
    }
    
    const filtered = records.filter(r => new Date(r.date) >= startDate);
    
    // 按时间分组
    const grouped = {};
    filtered.forEach(r => {
        const dateKey = timeRange === 'year' ? 
            new Date(r.date).getMonth() + 1 + '月' :
            r.date;
            
        grouped[dateKey] = (grouped[dateKey] || 0) + 2; // 每节课2课时
    });
    
    return {
        labels: Object.keys(grouped),
        data: Object.values(grouped)
    };
}
// 修改 generateStatistics 函数中的记录排序
function generateStatistics() {
    if (!startDateInput.value || !endDateInput.value) {
        DialogBridge.alert('请选择起始日期和结束日期');
        return;
    }
    
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    const selectedClass = statClassInput.value;
    
    if (startDate > endDate) {
        DialogBridge.alert('起始日期不能晚于结束日期');
        return;
    }
    
    // 过滤记录并按日期和节次排序
    const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        const dateMatch = recordDate >= startDate && recordDate <= endDate;
        const classMatch = !selectedClass || record.class === selectedClass;
        return dateMatch && classMatch;
    }).sort((a, b) => {
        // 先按日期排序
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        
        // 日期相同则按节次排序
        const sessionOrder = { '12节': 1, '34节': 2, '56节': 3, '晚自习': 4 };
        return sessionOrder[a.session] - sessionOrder[b.session];
    });
    
    if (filteredRecords.length === 0) {
        statisticsSummary.innerHTML = '<p>所选日期范围内没有记录</p>';
        statisticsDetails.innerHTML = '';
        return;
    }
    
    // 按课型统计
    const typeStats = {};
    filteredRecords.forEach(record => {
        if (!typeStats[record.type]) {
            typeStats[record.type] = 0;
        }
        // 每节课计为2课时
        typeStats[record.type] += 2;
    });
    
    // 渲染统计结果
    renderStatistics(typeStats, filteredRecords);
}

// 渲染统计结果
function renderStatistics(typeStats, records) {
    // 汇总统计
    let summaryHtml = '<div class="stat-summary">';
    summaryHtml += '<h3>课时汇总</h3>';
    summaryHtml += '<table class="stat-table"><thead><tr><th>课型</th><th>课时数</th></tr></thead><tbody>';
    
    let totalHours = 0;
    for (const [type, hours] of Object.entries(typeStats)) {
        summaryHtml += `<tr><td>${type}</td><td>${hours}</td></tr>`;
        totalHours += hours;
    }
    
    summaryHtml += `<tr class="total-row"><td><strong>总计</strong></td><td><strong>${totalHours}</strong></td></tr>`;
    summaryHtml += '</tbody></table>';
    summaryHtml += '</div>';
    
    statisticsSummary.innerHTML = summaryHtml;
    
    // 详细记录
    let detailsHtml = '<div class="stat-details">';
    detailsHtml += '<h3>详细记录</h3>';
    detailsHtml += '<table class="stat-table"><thead><tr><th>日期</th><th>节次</th><th>班级</th><th>课程</th><th>课型</th><th>课时</th></tr></thead><tbody>';
    
    records.forEach(record => {
        detailsHtml += `<tr>
            <td>${record.date}</td>
            <td>${record.session}</td>
            <td>${record.class}</td>
            <td>${record.course}</td>
            <td>${record.type}</td>
            <td>2</td>
        </tr>`;
    });
    
    detailsHtml += '</tbody></table>';
    detailsHtml += '</div>';
    
    statisticsDetails.innerHTML = detailsHtml;
}
//导出为excel
function exportToExcel() {
    if (!statisticsSummary.innerHTML) {
        DialogBridge.alert('请先生成统计数据');
        return;
    }
    
    try {
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        
        // 创建汇总工作表
        const summaryData = [
            ['课时统计报表'],
            ['统计日期', `${startDateInput.value} 至 ${endDateInput.value}`],
            ['班级筛选', statClassInput.value || '全部班级'],
            [''],
            ['课时汇总'],
            ['课型', '课时数']
        ];
        
        // 获取汇总数据
        const summaryRows = statisticsSummary.querySelectorAll('.stat-table tbody tr');
        summaryRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 2) {
                summaryData.push([cells[0].textContent, cells[1].textContent]);
            }
        });
        
        // 添加详细记录标题
        summaryData.push(['']);
        summaryData.push(['详细课时记录']);
        summaryData.push(['日期', '节次', '班级', '课程', '课型', '课时']);
        
        // 获取详细记录数据
        const detailRows = statisticsDetails.querySelectorAll('.stat-table tbody tr');
        detailRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 6) {
                summaryData.push([
                    cells[0].textContent,
                    cells[1].textContent,
                    cells[2].textContent,
                    cells[3].textContent,
                    cells[4].textContent,
                    cells[5].textContent
                ]);
            }
        });
        
        // 添加备注
        if (statNotesInput.value) {
            summaryData.push(['']);
            summaryData.push(['备注信息']);
            summaryData.push([statNotesInput.value]);
        }
        
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        
        // 设置列宽
        const wscols = [
            {wch: 12}, // 日期
            {wch: 8},  // 节次
            {wch: 15}, // 班级
            {wch: 15}, // 课程
            {wch: 10}, // 课型
            {wch: 8}  // 课时
        ];
        ws['!cols'] = wscols;
        
        // 设置标题样式
        if (!ws['A1'].s) ws['A1'].s = {};
        ws['A1'].s = {
            font: { sz: 16, bold: true },
            alignment: { horizontal: 'center' }
        };
        
        // 合并标题单元格
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, "课时统计");
        
        // 导出文件
        const fileName = `课时统计_${startDateInput.value}_至_${endDateInput.value}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        DialogBridge.alert('Excel导出成功');
    } catch (error) {
        console.error('导出Excel出错:', error);
        DialogBridge.alert('导出Excel时出错: ' + error.message);
    }
}
// 修改后的exportToPdf函数
async function exportToPdf() {
    if (!statisticsSummary.innerHTML) {
        DialogBridge.alert('请先生成统计数据');
        return;
    }

    try {
        // 显示加载提示
        DialogBridge.alert('正在生成PDF，请稍候...');
        
        // 1. 创建临时导出容器
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.style.width = '800px';
        exportContainer.style.backgroundColor = 'white';
        exportContainer.style.padding = '20px';
        document.body.appendChild(exportContainer);

        // 2. 克隆需要导出的内容
        const titleHtml = `
            <h1 style="text-align: center; margin-bottom: 10px; font-size: 24px;">课时统计报表</h1>
            <div style="text-align: center; margin-bottom: 20px; font-size: 14px;">
                统计日期: ${startDateInput.value} 至 ${endDateInput.value} | 
                班级筛选: ${statClassInput.value || '全部班级'}
            </div>
        `;
        exportContainer.innerHTML = titleHtml;
        
        // 克隆统计结果(排除按钮)
        const statisticsResult = document.querySelector('.statistics-result');
        const statsClone = statisticsResult.cloneNode(true);
        // 移除整个备注区域
        const notesSection = statsClone.querySelector('.notes-section');
        if (notesSection) {
            notesSection.remove();
        }
        // 移除导出按钮容器
        statsClone.querySelectorAll('button').forEach(btn => btn.remove());

        exportContainer.appendChild(statsClone);

        // 3. 添加备注信息(如果有)
        if (statNotesInput.value) {
            const notesHtml = `
                <div style="margin-top: 30px;">
                    <h3 style="font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px;">备注信息</h3>
                    <div style="font-size: 14px; line-height: 1.5; margin-top: 10px;">
                        ${statNotesInput.value.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
            exportContainer.innerHTML += notesHtml;
        }

        // 4. 转换为Canvas
        const canvas = await html2canvas(exportContainer, {
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: exportContainer.scrollWidth,
            windowHeight: exportContainer.scrollHeight
        });

        // 5. 创建PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // 6. 添加图像到PDF
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = doc.internal.pageSize.getWidth() - 20; // A4宽度减边距
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        doc.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

        // 7. 处理多页内容
        let heightLeft = imgHeight;
        let position = 10;
        const pageHeight = doc.internal.pageSize.getHeight();
        
        while (heightLeft >= pageHeight - 10) {
            position = heightLeft - (pageHeight - 10);
            doc.addPage();
            doc.addImage(imgData, 'PNG', 10, -position, imgWidth, imgHeight);
            heightLeft -= pageHeight - 10;
        }

        // 8. 清理并保存
        document.body.removeChild(exportContainer);
        const fileName = `课时统计_${startDateInput.value}_至_${endDateInput.value}.pdf`;
        doc.save(fileName);
        
        DialogBridge.alert('PDF导出成功');
    } catch (error) {
        console.error('导出PDF出错:', error);
        DialogBridge.alert('导出PDF时出错: ' + error.message);
    }
}

function initCharts() {
    const timeRangeSelect = document.getElementById('time-range');
    const refreshBtn = document.getElementById('refresh-chart');
    
    // 设置默认时间范围为周视图
    timeRangeSelect.value = 'week';
    
    refreshBtn.addEventListener('click', () => {
        renderCharts(timeRangeSelect.value);
    });
    
    timeRangeSelect.addEventListener('change', () => {
        renderCharts(timeRangeSelect.value);
    });
    
    // 初始渲染
    renderCharts('week');
}

function renderCharts(timeRange) {
    const ctx = document.getElementById('hours-chart');
    const filteredRecords = getFilteredRecords(timeRange);
    
    // 销毁之前的图表实例
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: filteredRecords.labels,
            datasets: [{
                label: '课时数',
                data: filteredRecords.data,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '课时数'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: getAxisTitle(timeRange)
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: getChartTitle(timeRange),
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
    
    console.log('All records:', records);
    console.log('Filtered records:', filteredRecords);
}

function getAxisTitle(timeRange) {
    switch(timeRange) {
        case 'week': return '日期';
        case 'month': return '周次';
        case 'year': return '月份';
        default: return '';
    }
}

function getChartTitle(timeRange) {
    switch(timeRange) {
        case 'week': return '本周课时统计';
        case 'month': return '本月课时统计';
        case 'year': return '年度课时统计';
        default: return '课时统计';
    }
}

function getFilteredRecords(timeRange) {
    const today = new Date();
    let startDate = new Date();
    let groupByFunction;
    
    switch(timeRange) {
        case 'week':
            startDate.setDate(today.getDate() - 7);
            groupByFunction = (date) => date.toISOString().split('T')[0]; // 按天分组
            break;
        case 'month':
            startDate.setMonth(today.getMonth() - 1);
            groupByFunction = (date) => {
                // 按周分组
                const oneJan = new Date(date.getFullYear(), 0, 1);
                const weekNumber = Math.ceil((((date - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
                return `第${weekNumber}周`;
            };
            break;
        case 'year':
            startDate.setFullYear(today.getFullYear() - 1);
            groupByFunction = (date) => (date.getMonth() + 1) + '月'; // 按月分组
            break;
    }
    
    const filtered = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= startDate && recordDate <= today;
    });
    
    // 按时间分组
    const grouped = {};
    filtered.forEach(r => {
        const recordDate = new Date(r.date);
        const key = groupByFunction(recordDate);
        grouped[key] = (grouped[key] || 0) + 2; // 每节课2课时
    });
    
    // 对标签进行排序
    const sortedLabels = Object.keys(grouped).sort((a, b) => {
        if (timeRange === 'week') {
            return new Date(a) - new Date(b);
        } else if (timeRange === 'month') {
            return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
        } else if (timeRange === 'year') {
            return parseInt(a) - parseInt(b);
        }
        return 0;
    });
    
    const sortedData = sortedLabels.map(label => grouped[label]);
    
    return {
        labels: sortedLabels,
        data: sortedData
    };
}

});

// 与Android交互的接口 - 数据
function loadDataFromAndroid(callback) {
    if (window.AndroidInterface) {
        const data = AndroidInterface.loadData();
        callback(data);
    } else {
        console.log("Running in browser, using localStorage");
        const savedData = localStorage.getItem('classRecords');
        callback(savedData || '[]');
    }
}

function saveDataToAndroid(data) {
    if (window.AndroidInterface) {
        AndroidInterface.saveData(data);
    } else {
        console.log("Running in browser, saving to localStorage");
        localStorage.setItem('classRecords', data);
    }
}

// 与Android交互的接口 - 设置
function loadSettingsFromAndroid(callback) {
    if (window.AndroidInterface) {
        const settings = AndroidInterface.loadSettings();
        callback(settings);
    } else {
        console.log("Running in browser, using localStorage");
        const savedSettings = localStorage.getItem('classSettings');
        callback(savedSettings || '{"classes":[],"courses":[],"types":[]}');
    }
}

function saveSettingsToAndroid(settings) {
    if (window.AndroidInterface) {
        AndroidInterface.saveSettings(settings);
    } else {
        console.log("Running in browser, saving to localStorage");
        localStorage.setItem('classSettings', settings);
    }
}
/**
 * 通用弹窗桥接服务
 */
const DialogBridge = {
    // 检测运行环境
    isAndroidWebView: () => !!window.AndroidBridge,
    isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),

    // 统一调用入口
    confirm: (message) => {
        // Android WebView 环境
        if (DialogBridge.isAndroidWebView()) {
            return new Promise((resolve) => {
                // 生成唯一回调函数名
                const callbackName = `dialog_cb_${Date.now()}`;
                
                // 临时挂载到window
                window[callbackName] = (result) => {
                    delete window[callbackName]; // 清理
                    resolve(result);
                };

                // 调用原生桥接
                window.AndroidBridge.showConfirm(
                    message,
                    callbackName
                );
            });
        }
        // iOS 或其他环境
        else {
            return new Promise((resolve) => {
                const result = window.confirm(message);
                resolve(result);
            });
        }
    },
    
    // 提示框
    alert: (message) => {
        if (DialogBridge.isAndroidWebView()) {
            return new Promise((resolve) => {
                const callbackName = `alert_cb_${Date.now()}`;
                window[callbackName] = () => {
                    delete window[callbackName];
                    resolve();
                };
                window.AndroidBridge.showAlert(message, callbackName);
            });
        } else {
            return new Promise((resolve) => {
                window.alert(message);
                resolve();
            });
        }
    }
};






