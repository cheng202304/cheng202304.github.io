/**
 * 教师课时记录系统 - 重构版
 * 使用IIFE和命名空间模式组织代码，避免全局污染
 * 支持Android WebView和浏览器环境
 */
(function(window, document) {
    'use strict';
    
    // 主命名空间
    const TeacherRecordSystem = {
        // 应用配置
        config: {
            recordsPerPage: 10,
            defaultSettings: {
                classes: ["23对口计算机", "23春电子商务", "24春电子商务", "23秋电子商务一"],
                courses: ["网页设计", "网站建设与维护", "计算机网络技术", "计算机应用基础"],
                types: ["理论课", "实训课", "复习课"]
            }
        },
        
        // 应用状态
        state: {
            records: [],
            editingId: null,
            settings: {},
            chartInstance: null,
            currentPage: 1
        },
        
        // DOM元素缓存
        elements: {},
        
        // 初始化应用
        init: function() {
            this.cacheDomElements();
            this.bindEvents();
            this.showStartAnimation();
            this.loadData();
            this.loadSettings();
            this.initStatistics();
            this.initCharts();
        },
        
        // 缓存DOM元素
        cacheDomElements: function() {
            this.elements = {
                startAnimation: document.getElementById('start-animation'),
                container: document.querySelector('.container'),
                
                // 表单元素
                dateInput: document.getElementById('date'),
                sessionInput: document.getElementById('session'),
                classInput: document.getElementById('class'),
                courseInput: document.getElementById('course'),
                typeInput: document.getElementById('type'),
                saveBtn: document.getElementById('save-btn'),
                recordsList: document.getElementById('records-list'),
                
                // 设置元素
                newClassInput: document.getElementById('new-class'),
                addClassBtn: document.getElementById('add-class'),
                classList: document.getElementById('class-list'),
                newCourseInput: document.getElementById('new-course'),
                addCourseBtn: document.getElementById('add-course'),
                courseList: document.getElementById('course-list'),
                newTypeInput: document.getElementById('new-type'),
                addTypeBtn: document.getElementById('add-type'),
                typeList: document.getElementById('type-list'),
                saveSettingsBtn: document.getElementById('save-settings'),
                
                // 统计元素
                startDateInput: document.getElementById('start-date'),
                endDateInput: document.getElementById('end-date'),
                statClassInput: document.getElementById('stat-class'),
                generateStatBtn: document.getElementById('generate-stat'),
                statisticsSummary: document.getElementById('statistics-summary'),
                statisticsDetails: document.getElementById('statistics-details'),
                statNotesInput: document.getElementById('stat-notes'),
                exportExcelBtn: document.getElementById('export-excel'),
                exportPdfBtn: document.getElementById('export-pdf'),
                
                // 其他元素
                closeBtn: document.getElementById('close-btn'),
                backupBtn: document.getElementById('backup-btn'),
                restoreBtn: document.getElementById('restore-btn'),
                backupStatus: document.getElementById('backup-status'),
                tabBtns: document.querySelectorAll('.tab-btn'),
                tabContents: document.querySelectorAll('.tab-content')
            };
            
            // 设置默认日期为今天
            const today = new Date().toISOString().split('T')[0];
            this.elements.dateInput.value = today;
        },
        
        // 绑定事件
        bindEvents: function() {
            // 关闭按钮
            this.elements.closeBtn.addEventListener('click', this.handleCloseApp.bind(this));
            
            // 备份/恢复按钮
            this.elements.backupBtn.addEventListener('click', this.backupData.bind(this));
            this.elements.restoreBtn.addEventListener('click', this.restoreData.bind(this));
            
            // 标签页切换
            this.elements.tabBtns.forEach(btn => {
                btn.addEventListener('click', this.switchTab.bind(this));
            });
            
            // 保存记录按钮
            this.elements.saveBtn.addEventListener('click', this.saveRecord.bind(this));
            
            // 设置相关按钮
            this.elements.addClassBtn.addEventListener('click', () => 
                this.addSettingItem('classes', this.elements.newClassInput));
            this.elements.addCourseBtn.addEventListener('click', () => 
                this.addSettingItem('courses', this.elements.newCourseInput));
            this.elements.addTypeBtn.addEventListener('click', () => 
                this.addSettingItem('types', this.elements.newTypeInput));
            this.elements.saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
            
            // 回车键添加项目
            this.elements.newClassInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSettingItem('classes', this.elements.newClassInput);
            });
            this.elements.newCourseInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSettingItem('courses', this.elements.newCourseInput);
            });
            this.elements.newTypeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSettingItem('types', this.elements.newTypeInput);
            });
            
            // 统计按钮
            this.elements.generateStatBtn.addEventListener('click', this.generateStatistics.bind(this));
            this.elements.exportExcelBtn.addEventListener('click', this.exportToExcel.bind(this));
            this.elements.exportPdfBtn.addEventListener('click', this.exportToPdf.bind(this));
        },
        
        // 显示启动动画
        showStartAnimation: function() {
            setTimeout(() => {
                this.elements.startAnimation.style.opacity = '0';
                setTimeout(() => {
                    this.elements.startAnimation.style.display = 'none';
                    this.elements.container.style.display = 'block';
                }, 500);
            }, 2000);
        },
        
        // 切换标签页
        switchTab: function(e) {
            const tabId = e.target.getAttribute('data-tab');
            
            // 更新按钮状态
            this.elements.tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // 更新内容显示
            this.elements.tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        },
        
        // ==================== 数据管理 ====================
        
        // 加载数据
        loadData: function() {
            this.Storage.loadData((savedData) => {
                try {
                    this.state.records = JSON.parse(savedData) || [];
                    this.renderRecords();
                } catch (e) {
                    console.error("Error parsing data:", e);
                    this.state.records = [];
                    this.renderRecords();
                }
            });
        },
        
        // 加载设置
        loadSettings: function() {
            this.Storage.loadSettings((savedSettings) => {
                try {
                    const parsedSettings = JSON.parse(savedSettings);
                    if (parsedSettings && 
                        Array.isArray(parsedSettings.classes) && 
                        Array.isArray(parsedSettings.courses) && 
                        Array.isArray(parsedSettings.types)) {
                        this.state.settings = parsedSettings;
                    } else {
                        this.state.settings = {...this.config.defaultSettings};
                    }
                } catch (e) {
                    console.error("Error parsing settings:", e);
                    this.state.settings = {...this.config.defaultSettings};
                }
                this.renderSettings();
                this.updateFormOptions();
            });
        },
        
        // 保存记录
        saveRecord: function() {
            // 验证输入
            if (!this.elements.dateInput.value || !this.elements.sessionInput.value || 
                !this.elements.classInput.value || !this.elements.courseInput.value || 
                !this.elements.typeInput.value) {
                this.Dialog.alert('请填写所有字段');
                return;
            }
            
            const record = {
                id: this.state.editingId || Date.now(),
                date: this.elements.dateInput.value,
                session: this.elements.sessionInput.value,
                class: this.elements.classInput.value,
                course: this.elements.courseInput.value,
                type: this.elements.typeInput.value
            };
            
            if (this.state.editingId) {
                // 更新现有记录
                const index = this.state.records.findIndex(r => r.id === this.state.editingId);
                if (index !== -1) {
                    this.state.records[index] = record;
                }
                this.state.editingId = null;
                this.elements.saveBtn.textContent = '保存记录';
            } else {
                // 添加新记录
                this.state.records.push(record);
                this.state.currentPage = 1; // 新增记录后显示第一页
            }
            
            // 保存并刷新
            this.Storage.saveData(JSON.stringify(this.state.records));
            this.renderRecords();
            this.resetForm();
        },
        
        // 重置表单
        resetForm: function() {
            const today = new Date().toISOString().split('T')[0];
            this.elements.dateInput.value = today;
            this.elements.sessionInput.value = '';
            this.elements.classInput.value = '';
            this.elements.courseInput.value = '';
            this.elements.typeInput.value = '';
        },
        
        // 渲染记录列表
        renderRecords: function() {
            const recordsList = this.elements.recordsList;
            recordsList.innerHTML = '';
            
            if (this.state.records.length === 0) {
                recordsList.innerHTML = '<p>暂无记录</p>';
                return;
            }
            
            // 按登记时间倒序排序
            this.state.records.sort((a, b) => b.id - a.id);
            
            // 计算分页
            const totalPages = Math.ceil(this.state.records.length / this.config.recordsPerPage);
            if (this.state.currentPage > totalPages && totalPages > 0) {
                this.state.currentPage = totalPages;
            }
            
            // 获取当前页记录
            const startIndex = (this.state.currentPage - 1) * this.config.recordsPerPage;
            const endIndex = Math.min(startIndex + this.config.recordsPerPage, this.state.records.length);
            const currentRecords = this.state.records.slice(startIndex, endIndex);
            
            // 渲染记录
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
                prevBtn.disabled = this.state.currentPage === 1;
                prevBtn.addEventListener('click', () => {
                    this.state.currentPage--;
                    this.renderRecords();
                });
                
                // 页码信息
                const pageInfo = document.createElement('span');
                pageInfo.textContent = `第 ${this.state.currentPage} 页 / 共 ${totalPages} 页`;
                
                // 下一页按钮
                const nextBtn = document.createElement('button');
                nextBtn.textContent = '下一页';
                nextBtn.disabled = this.state.currentPage === totalPages;
                nextBtn.addEventListener('click', () => {
                    this.state.currentPage++;
                    this.renderRecords();
                });
                
                pagination.appendChild(prevBtn);
                pagination.appendChild(pageInfo);
                pagination.appendChild(nextBtn);
                recordsList.appendChild(pagination);
            }
            
            // 绑定删除和编辑事件
            recordsList.querySelectorAll('.delete').forEach(btn => {
                btn.addEventListener('click', this.deleteRecord.bind(this));
            });
            
            recordsList.querySelectorAll('.edit').forEach(btn => {
                btn.addEventListener('click', this.editRecord.bind(this));
            });
        },
        
        // 删除记录
        deleteRecord: async function(e) {
            const id = parseInt(e.target.getAttribute('data-id'));
            try {
                const confirmed = await this.Dialog.confirm("确定要删除这条记录吗？");
                if (confirmed) {
                    this.state.records = this.state.records.filter(record => record.id !== id);
                    this.Storage.saveData(JSON.stringify(this.state.records));
                    this.renderRecords();
                }
            } catch (err) {
                console.error("弹窗出错:", err);
            }
        },
        
        // 编辑记录
        editRecord: function(e) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const record = this.state.records.find(r => r.id === id);
            
            if (record) {
                this.elements.dateInput.value = record.date;
                this.elements.sessionInput.value = record.session;
                this.elements.classInput.value = record.class;
                this.elements.courseInput.value = record.course;
                this.elements.typeInput.value = record.type;
                
                this.state.editingId = id;
                this.elements.saveBtn.textContent = '更新记录';
                
                // 滚动到表单
                document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
            }
        },
        
        // ==================== 设置管理 ====================
        
        // 渲染设置
        renderSettings: function() {
            this.renderSettingList('classes', this.elements.classList);
            this.renderSettingList('courses', this.elements.courseList);
            this.renderSettingList('types', this.elements.typeList);
        },
        
        // 渲染单个设置列表
        renderSettingList: function(settingKey, listElement) {
            listElement.innerHTML = '';
            this.state.settings[settingKey].forEach((item, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${item}</span>
                    <button class="delete-setting" data-type="${settingKey}" data-index="${index}">删除</button>
                `;
                listElement.appendChild(li);
            });
            
            // 添加删除事件
            listElement.querySelectorAll('.delete-setting').forEach(btn => {
                btn.addEventListener('click', this.deleteSettingItem.bind(this));
            });
        },
        
        // 更新表单选项
        updateFormOptions: function() {
            this.updateSelectOptions(this.elements.classInput, this.state.settings.classes);
            this.updateSelectOptions(this.elements.courseInput, this.state.settings.courses);
            this.updateSelectOptions(this.elements.typeInput, this.state.settings.types);
            this.updateSelectOptions(this.elements.statClassInput, this.state.settings.classes, true);
        },
        
        // 更新选择框选项
        updateSelectOptions: function(selectElement, options, includeAllOption = false) {
            const selectedValue = selectElement.value;
            selectElement.innerHTML = '';
            
            if (includeAllOption) {
                const allOption = document.createElement('option');
                allOption.value = '';
                allOption.textContent = '全部班级';
                selectElement.appendChild(allOption);
            } else {
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '请选择';
                selectElement.appendChild(defaultOption);
            }
            
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                selectElement.appendChild(opt);
            });
            
            if (options.includes(selectedValue)) {
                selectElement.value = selectedValue;
            }
        },
        
        // 添加设置项
        addSettingItem: function(settingKey, inputElement) {
            const value = inputElement.value.trim();
            if (value && !this.state.settings[settingKey].includes(value)) {
                this.state.settings[settingKey].push(value);
                inputElement.value = '';
                this.renderSettings();
                this.updateFormOptions();
            }
        },
        
        // 删除设置项
        deleteSettingItem: async function(e) {
            const settingKey = e.target.getAttribute('data-type');
            const index = parseInt(e.target.getAttribute('data-index'));
            
            try {
                const confirmed = await this.Dialog.confirm("确定要删除此项吗？");
                if (confirmed) {
                    this.state.settings[settingKey].splice(index, 1);
                    this.renderSettings();
                    this.updateFormOptions();
                    this.checkRecordsAfterDeletion(settingKey, index);
                }
            } catch (err) {
                console.error("弹窗出错:", err);
            }
        },
        
        // 检查记录是否需要更新
        checkRecordsAfterDeletion: function(settingKey, deletedIndex) {
            const deletedItem = this.state.settings[settingKey][deletedIndex];
            
            this.state.records.forEach(record => {
                if (settingKey === 'classes' && record.class === deletedItem) {
                    record.class = '';
                } else if (settingKey === 'courses' && record.course === deletedItem) {
                    record.course = '';
                } else if (settingKey === 'types' && record.type === deletedItem) {
                    record.type = '';
                }
            });
            
            this.Storage.saveData(JSON.stringify(this.state.records));
            this.renderRecords();
        },
        
        // 保存设置
        saveSettings: function() {
            this.Storage.saveSettings(JSON.stringify(this.state.settings));
            this.Dialog.alert("设置已保存");
        },
        
        // ==================== 统计功能 ====================
        
        // 初始化统计页面
        initStatistics: function() {
            this.setDefaultDateRange();
            this.updateFormOptions();
        },
        
        // 设置默认日期范围（本月）
        setDefaultDateRange: function() {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            
            this.elements.startDateInput.value = firstDay.toISOString().split('T')[0];
            this.elements.endDateInput.value = today.toISOString().split('T')[0];
        },
        
        // 生成统计数据
        generateStatistics: function() {
            if (!this.elements.startDateInput.value || !this.elements.endDateInput.value) {
                this.Dialog.alert('请选择起始日期和结束日期');
                return;
            }
            
            const startDate = new Date(this.elements.startDateInput.value);
            const endDate = new Date(this.elements.endDateInput.value);
            const selectedClass = this.elements.statClassInput.value;
            
            if (startDate > endDate) {
                this.Dialog.alert('起始日期不能晚于结束日期');
                return;
            }
            
            // 过滤记录并按日期和节次排序
            const filteredRecords = this.state.records.filter(record => {
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
                this.elements.statisticsSummary.innerHTML = '<p>所选日期范围内没有记录</p>';
                this.elements.statisticsDetails.innerHTML = '';
                return;
            }
            
            // 按课型统计
            const typeStats = {};
            filteredRecords.forEach(record => {
                if (!typeStats[record.type]) {
                    typeStats[record.type] = 0;
                }
                typeStats[record.type] += 2; // 每节课计为2课时
            });
            
            // 渲染统计结果
            this.renderStatistics(typeStats, filteredRecords);
        },
        
        // 渲染统计结果
        renderStatistics: function(typeStats, records) {
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
            
            this.elements.statisticsSummary.innerHTML = summaryHtml;
            
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
            
            this.elements.statisticsDetails.innerHTML = detailsHtml;
        },
        
        // 导出为Excel
        exportToExcel: function() {
            if (!this.elements.statisticsSummary.innerHTML) {
                this.Dialog.alert('请先生成统计数据');
                return;
            }
            
            try {
                // 创建工作簿
                const wb = XLSX.utils.book_new();
                
                // 创建汇总工作表
                const summaryData = [
                    ['课时统计报表'],
                    ['统计日期', `${this.elements.startDateInput.value} 至 ${this.elements.endDateInput.value}`],
                    ['班级筛选', this.elements.statClassInput.value || '全部班级'],
                    [''],
                    ['课时汇总'],
                    ['课型', '课时数']
                ];
                
                // 获取汇总数据
                const summaryRows = this.elements.statisticsSummary.querySelectorAll('.stat-table tbody tr');
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
                const detailRows = this.elements.statisticsDetails.querySelectorAll('.stat-table tbody tr');
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
                if (this.elements.statNotesInput.value) {
                    summaryData.push(['']);
                    summaryData.push(['备注信息']);
                    summaryData.push([this.elements.statNotesInput.value]);
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
                const fileName = `课时统计_${this.elements.startDateInput.value}_至_${this.elements.endDateInput.value}.xlsx`;
                XLSX.writeFile(wb, fileName);
                
                this.Dialog.alert('Excel导出成功');
            } catch (error) {
                console.error('导出Excel出错:', error);
                this.Dialog.alert('导出Excel时出错: ' + error.message);
            }
        },
        
        // 导出为PDF
        exportToPdf: async function() {
            if (!this.elements.statisticsSummary.innerHTML) {
                this.Dialog.alert('请先生成统计数据');
                return;
            }

            try {
                // 显示加载提示
                this.Dialog.alert('正在生成PDF，请稍候...');
                
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
                        统计日期: ${this.elements.startDateInput.value} 至 ${this.elements.endDateInput.value} | 
                        班级筛选: ${this.elements.statClassInput.value || '全部班级'}
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
                if (this.elements.statNotesInput.value) {
                    const notesHtml = `
                        <div style="margin-top: 30px;">
                            <h3 style="font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px;">备注信息</h3>
                            <div style="font-size: 14px; line-height: 1.5; margin-top: 10px;">
                                ${this.elements.statNotesInput.value.replace(/\n/g, '<br>')}
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
                const fileName = `课时统计_${this.elements.startDateInput.value}_至_${this.elements.endDateInput.value}.pdf`;
                doc.save(fileName);
                
                this.Dialog.alert('PDF导出成功');
            } catch (error) {
                console.error('导出PDF出错:', error);
                this.Dialog.alert('导出PDF时出错: ' + error.message);
            }
        },
        
        // ==================== 图表功能 ====================
        
        // 初始化图表
        initCharts: function() {
            const timeRangeSelect = document.getElementById('time-range');
            const refreshBtn = document.getElementById('refresh-chart');
            
            // 设置默认时间范围为周视图
            timeRangeSelect.value = 'week';
            
            refreshBtn.addEventListener('click', () => {
                this.renderCharts(timeRangeSelect.value);
            });
            
            timeRangeSelect.addEventListener('change', () => {
                this.renderCharts(timeRangeSelect.value);
            });
            
            // 初始渲染
            this.renderCharts('week');
        },
        
        // 渲染图表
        renderCharts: function(timeRange) {
            const ctx = document.getElementById('hours-chart');
            const filteredRecords = this.getFilteredRecords(timeRange);
            
            // 销毁之前的图表实例
            if (this.state.chartInstance) {
                this.state.chartInstance.destroy();
            }
            
            this.state.chartInstance = new Chart(ctx, {
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
                                text: this.getAxisTitle(timeRange)
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: this.getChartTitle(timeRange),
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
        },
        
        // 获取X轴标题
        getAxisTitle: function(timeRange) {
            switch(timeRange) {
                case 'week': return '日期';
                case 'month': return '周次';
                case 'year': return '月份';
                default: return '';
            }
        },
        
        // 获取图表标题
        getChartTitle: function(timeRange) {
            switch(timeRange) {
                case 'week': return '本周课时统计';
                case 'month': return '本月课时统计';
                case 'year': return '年度课时统计';
                default: return '课时统计';
            }
        },
        
        // 获取过滤后的记录
        getFilteredRecords: function(timeRange) {
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
            
            const filtered = this.state.records.filter(r => {
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
        },
        
        // ==================== 备份与恢复 ====================
        
        // 备份数据
        backupData: function() {
            const data = localStorage.getItem('classRecords');
            const blob = new Blob([data], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'class_records_backup_' + new Date().toISOString().slice(0,10) + '.json';
            a.click();
            
            this.elements.backupStatus.textContent = '备份成功！';
            setTimeout(() => {
                this.elements.backupStatus.textContent = '';
            }, 3000);
        },
        
        // 恢复数据
        restoreData: function() {
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
                        this.elements.backupStatus.textContent = '还原成功！';
                        setTimeout(() => {
                            this.elements.backupStatus.textContent = '';
                            location.reload();
                        }, 3000);
                    } catch (error) {
                        this.elements.backupStatus.textContent = '文件格式错误！';
                    }
                };
                
                reader.readAsText(file);
            };
            
            input.click();
        },
        
        // ==================== 应用关闭 ====================
        
        // 处理关闭应用
        handleCloseApp: function() {
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
        },
        
        // ==================== 工具方法 ====================
        
        // 存储工具
        Storage: {
            loadData: function(callback) {
                if (window.AndroidInterface) {
                    const data = AndroidInterface.loadData();
                    callback(data);
                } else {
                    console.log("Running in browser, using localStorage");
                    const savedData = localStorage.getItem('classRecords');
                    callback(savedData || '[]');
                }
            },
            
            saveData: function(data) {
                if (window.AndroidInterface) {
                    AndroidInterface.saveData(data);
                } else {
                    console.log("Running in browser, saving to localStorage");
                    localStorage.setItem('classRecords', data);
                }
            },
            
            loadSettings: function(callback) {
                if (window.AndroidInterface) {
                    const settings = AndroidInterface.loadSettings();
                    callback(settings);
                } else {
                    console.log("Running in browser, using localStorage");
                    const savedSettings = localStorage.getItem('classSettings');
                    callback(savedSettings || '{"classes":[],"courses":[],"types":[]}');
                }
            },
            
            saveSettings: function(settings) {
                if (window.AndroidInterface) {
                    AndroidInterface.saveSettings(settings);
                } else {
                    console.log("Running in browser, saving to localStorage");
                    localStorage.setItem('classSettings', settings);
                }
            }
        },
        
        // 对话框工具
        Dialog: {
            // 检测运行环境
            isAndroidWebView: () => !!window.AndroidBridge,
            isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),

            // 确认对话框
            confirm: function(message) {
                // Android WebView 环境
                if (this.isAndroidWebView()) {
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
            alert: function(message) {
                if (this.isAndroidWebView()) {
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
        }
    };
    
    // 初始化应用
    window.TeacherRecordSystem = TeacherRecordSystem;
    document.addEventListener('DOMContentLoaded', function() {
        TeacherRecordSystem.init();
    });
    
})(window, document);