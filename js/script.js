// 注册Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker注册成功: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker注册失败: ', err);
            });
    });
}

/**
 * 教师课时记录系统 - 增强版
 * 功能：
 * 1. 重复数据检测（日期+班级+节次）
 * 2. 智能推荐（基于频率统计）
 * 3. 数据验证与异常检测
 * 4. 全部清空功能
 * 教师课时记录系统 - 重构版
 * 使用IIFE和命名空间模式组织代码，避免全局污染
 * 支持Android WebView和浏览器环境
 */
(function (window, document) {
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
            },

            recommendation: {
                maxSuggestions: 3, // 最多显示推荐项数量
                decayFactor: 0.95, // 频率衰减因子(旧记录权重降低)
                minFrequency: 0.1, // 最小频率阈值
                contextMatchBonus: 1.5, // 上下文匹配加分
                recentDays: 30 // 近期记录的天数范围
            },
            validationRules: {
                date: /^\d{4}-\d{2}-\d{2}$/,
                session: /^(12节|34节|56节|晚自习)$/,
                class: /^.{1,50}$/,
                course: /^.{1,50}$/,
                type: /^.{1,20}$/
            }
        },

        // 应用状态
        state: {
            records: [],
            editingId: null,
            settings: {},
            chartInstance: null,
            currentPage: 1,

            frequencyStats: {
                classes: {},
                courses: {},
                types: {},
                classCoursePairs: {}, // 班级-课程组合频率
                courseTypePairs: {} // 课程-课型组合频率
            },
            lastRecommendationUpdate: null
        },

        // DOM元素缓存
        elements: {},

        // 初始化应用      
        init: function () {
            this.cacheDomElements();
            this.bindEvents();
            this.showStartAnimation();

            // 先加载设置，再加载数据
            this.loadSettings(() => {
                this.loadData();
                this.initStatistics();
                this.initCharts();
                this.analyzeUsageFrequency();
                this.setupRecommendationListeners();
               // this.initStatusDisplay();
            });
        },

        // 新增：初始化状态显示
        initStatusDisplay: function () {
            this.updateTotalRecordsCount();
            this.renderRecords();
            this.displayLastRecordInfo();
        },

        // 新增：显示最后一条记录信息
        displayLastRecordInfo: function () {
            const formContainer = document.querySelector('.form-container');
            let lastRecordInfo = document.getElementById('last-record-info');

            // 如果元素不存在则创建
            if (!lastRecordInfo) {
                lastRecordInfo = document.createElement('div');
                lastRecordInfo.id = 'last-record-info';
                lastRecordInfo.className = 'last-record-info';
                formContainer.insertBefore(lastRecordInfo, formContainer.firstChild);
            }

            if (this.state.records.length === 0) {
                lastRecordInfo.innerHTML = '<p>暂无记录</p>';
                return;
            }

            // 获取最新记录
            const lastRecord = this.state.records.reduce((prev, current) =>
                (prev.id > current.id) ? prev : current
            );

            lastRecordInfo.innerHTML = `
        <div class="last-record-summary">
            <h3>最后一条记录</h3>
            <div class="record-details">
                <p><span class="detail-label">日期:</span> ${lastRecord.date}</p>
                <p><span class="detail-label">节次:</span> ${lastRecord.session}</p>
                <p><span class="detail-label">班级:</span> ${lastRecord.class}</p>
                <p><span class="detail-label">课程:</span> ${lastRecord.course}</p>
                <p><span class="detail-label">课型:</span> ${lastRecord.type}</p>
            </div>
        </div>
    `;
        },

        // 新增：更新记录总数显示
        // 修改 updateTotalRecordsCount 方法
        updateTotalRecordsCount: function () {
            const recordsContainer = document.querySelector('.records-container');
            let countElement = document.getElementById('records-count');

            if (!countElement) {
                countElement = document.createElement('div');
                countElement.id = 'records-count';
                countElement.className = 'records-count';
                recordsContainer.insertBefore(countElement, recordsContainer.firstChild);
            }

            countElement.innerHTML = `
        <div class="count-container">
            <span class="count-icon">📊</span>
            <span class="count-text">总记录数: ${this.state.records.length}</span>
        </div>
    `;

            // 在保存记录后调用 displayLastRecordInfo
            if (this.state.records.length > 0) {
                this.displayLastRecordInfo();
            }
        },

        // 新增：分析使用频率
        analyzeUsageFrequency: function () {
            const now = new Date();
            const cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - this.config.recommendation.recentDays);

            // 初始化频率统计
            this.state.frequencyStats = {
                classes: {},
                courses: {},
                types: {},
                classCoursePairs: {},
                courseTypePairs: {}
            };

            // 分析记录
            this.state.records.forEach(record => {
                const recordDate = new Date(record.date);
                const isRecent = recordDate >= cutoffDate;
                const timeWeight = isRecent ? 1 : Math.pow(
                    this.config.recommendation.decayFactor,
                    Math.floor((now - recordDate) / (24 * 60 * 60 * 1000))
                );

                // 统计班级频率
                this.state.frequencyStats.classes[record.class] =
                    (this.state.frequencyStats.classes[record.class] || 0) + timeWeight;

                // 统计课程频率
                this.state.frequencyStats.courses[record.course] =
                    (this.state.frequencyStats.courses[record.course] || 0) + timeWeight;

                // 统计课型频率
                this.state.frequencyStats.types[record.type] =
                    (this.state.frequencyStats.types[record.type] || 0) + timeWeight;

                // 统计班级-课程组合频率
                const classCourseKey = `${record.class}|${record.course}`;
                this.state.frequencyStats.classCoursePairs[classCourseKey] =
                    (this.state.frequencyStats.classCoursePairs[classCourseKey] || 0) + timeWeight;

                // 统计课程-课型组合频率
                const courseTypeKey = `${record.course}|${record.type}`;
                this.state.frequencyStats.courseTypePairs[courseTypeKey] =
                    (this.state.frequencyStats.courseTypePairs[courseTypeKey] || 0) + timeWeight;
            });

            this.state.lastRecommendationUpdate = now;

        },

        // 新增：设置推荐监听器
        setupRecommendationListeners: function () {
            //日期为焦点时，推荐日期
            this.elements.dateInput.addEventListener('focus', () => {
                this.updateDateRecommendation();
            });

            //节次为焦点时，推荐节次
            this.elements.sessionInput.addEventListener('focus', () => {
                this.updateSessionRecommendation();
            });
            // 班级输入变化时推荐课程
            this.elements.classInput.addEventListener('change', () => {
                this.updateCourseRecommendations();
            });

            // 班级输入获得焦点时也推荐
            this.elements.classInput.addEventListener('focus', () => {
                this.updateClassRecommendations();
            });

            // 课程输入变化时推荐课型
            this.elements.courseInput.addEventListener('change', () => {
                this.updateTypeRecommendations();
            });

            // 初始化推荐
            this.updateClassRecommendations();
        },

        //新增：更新日期推荐
        updateDateRecommendation: function () {
            if (this.state.records.length === 0) {
                // 如果没有记录，默认今天和12节
                const today = new Date().toISOString().split('T')[0];
                this.elements.dateInput.value = today;
                this.elements.sessionInput.value = '12节';
                return;
            }

            // 获取最新记录
            const lastRecord = this.state.records.reduce((prev, current) =>
                (prev.id > current.id) ? prev : current
            );

            const lastDate = new Date(lastRecord.date);
            const lastSession = lastRecord.session;

            // 如果上一条记录是56节，则推荐下一个工作日
            if (lastSession === '56节') {
                const nextDate = new Date(lastDate);
                nextDate.setDate(lastDate.getDate() + 1);

                // 跳过周末
                while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
                    nextDate.setDate(nextDate.getDate() + 1);
                }

                this.elements.dateInput.value = nextDate.toISOString().split('T')[0];
                this.elements.sessionInput.value = '12节'; // 新的一天默认12节
            } else {
                // 否则推荐同一天
                this.elements.dateInput.value = lastRecord.date;
                // 根据上一条记录的节次推荐下一节次
                switch (lastSession) {
                    case '12节':
                        this.elements.sessionInput.value = '34节';
                        break;
                    case '34节':
                        this.elements.sessionInput.value = '56节';
                        break;
                    case '56节':
                        this.elements.sessionInput.value = '';
                        break;
                    default:
                        this.elements.sessionInput.value = '12节';
                }
            }
        },

        //新增： 更新节次推荐
        updateSessionRecommendation: function () {
            if (this.state.records.length === 0) return;

            // 获取最新记录
            const lastRecord = this.state.records.reduce((prev, current) =>
                (prev.id > current.id) ? prev : current
            );

            const lastSession = lastRecord.session;

            // 根据上一条记录的节次推荐下一节次
            switch (lastSession) {
                case '12节':
                    this.elements.sessionInput.value = '34节';
                    break;
                case '34节':
                    this.elements.sessionInput.value = '56节';
                    break;
                case '56节':
                    // 56节后不推荐晚自习，保持为空
                    this.elements.sessionInput.value = '';
                    break;
                default:
                    this.elements.sessionInput.value = '12节';
            }
        },

        // 新增：更新班级推荐
        updateClassRecommendations: function () {
            const recommendations = this.getTopRecommendations('classes');
            this.showRecommendations(this.elements.classInput, recommendations);
        },

        // 新增：更新课程推荐（基于班级上下文）
        updateCourseRecommendations: function () {
            const selectedClass = this.elements.classInput.value;
            let recommendations = [];

            if (selectedClass) {
                // 获取该班级最常使用的课程
                const classCourses = {};
                Object.keys(this.state.frequencyStats.classCoursePairs).forEach(key => {
                    const [cls, course] = key.split('|');
                    if (cls === selectedClass) {
                        classCourses[course] = this.state.frequencyStats.classCoursePairs[key];
                    }
                });

                // 如果没有班级特定的课程数据，回退到全局推荐
                if (Object.keys(classCourses).length > 0) {
                    recommendations = Object.entries(classCourses)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, this.config.recommendation.maxSuggestions)
                        .map(([course]) => course);
                }
            }

            // 如果没找到上下文相关推荐或没有选择班级，使用全局推荐
            if (recommendations.length === 0) {
                recommendations = this.getTopRecommendations('courses');
            }

            this.showRecommendations(this.elements.courseInput, recommendations);
        },

        // 新增：更新课型推荐（基于课程上下文）
        updateTypeRecommendations: function () {
            const selectedCourse = this.elements.courseInput.value;
            let recommendations = [];

            if (selectedCourse) {
                // 获取该课程最常使用的课型
                const courseTypes = {};
                Object.keys(this.state.frequencyStats.courseTypePairs).forEach(key => {
                    const [course, type] = key.split('|');
                    if (course === selectedCourse) {
                        courseTypes[type] = this.state.frequencyStats.courseTypePairs[key];
                    }
                });

                // 如果没有课程特定的课型数据，回退到全局推荐
                if (Object.keys(courseTypes).length > 0) {
                    recommendations = Object.entries(courseTypes)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, this.config.recommendation.maxSuggestions)
                        .map(([type]) => type);
                }
            }

            // 如果没找到上下文相关推荐或没有选择课程，使用全局推荐
            if (recommendations.length === 0) {
                recommendations = this.getTopRecommendations('types');
            }

            this.showRecommendations(this.elements.typeInput, recommendations);
        },

        // 新增：获取最高频的推荐项
        getTopRecommendations: function (category) {
            return Object.entries(this.state.frequencyStats[category])
                .filter(([_, freq]) => freq >= this.config.recommendation.minFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, this.config.recommendation.maxSuggestions)
                .map(([item]) => item);
        },

        // 新增：显示推荐项
        showRecommendations: function (inputElement, recommendations) {
            // 移除旧的推荐
            const existingRecommendations = inputElement.parentNode.querySelector('.recommendations');
            if (existingRecommendations) {
                existingRecommendations.remove();
            }

            if (recommendations.length === 0 || inputElement.value) {
                return;
            }

            // 创建推荐容器
            const container = document.createElement('div');
            container.className = 'recommendations';

            // 添加推荐项
            recommendations.forEach(item => {
                const rec = document.createElement('span');
                rec.className = 'recommendation-item';
                rec.textContent = item;
                rec.addEventListener('click', () => {
                    inputElement.value = item;
                    container.remove();

                    // 触发change事件以更新后续推荐
                    inputElement.dispatchEvent(new Event('change'));

                });
                container.appendChild(rec);
            });

            // 添加到DOM
            inputElement.parentNode.appendChild(container);
        },

        // 新增：更新频率统计
        updateFrequencyStats: function (record) {
            // 更新班级频率
            this.state.frequencyStats.classes[record.class] =
                (this.state.frequencyStats.classes[record.class] || 0) + 1;

            // 更新课程频率
            this.state.frequencyStats.courses[record.course] =
                (this.state.frequencyStats.courses[record.course] || 0) + 1;

            // 更新课型频率
            this.state.frequencyStats.types[record.type] =
                (this.state.frequencyStats.types[record.type] || 0) + 1;

            // 更新班级-课程组合频率
            const classCourseKey = `${record.class}|${record.course}`;
            this.state.frequencyStats.classCoursePairs[classCourseKey] =
                (this.state.frequencyStats.classCoursePairs[classCourseKey] || 0) + 1;

            // 更新课程-课型组合频率
            const courseTypeKey = `${record.course}|${record.type}`;
            this.state.frequencyStats.courseTypePairs[courseTypeKey] =
                (this.state.frequencyStats.courseTypePairs[courseTypeKey] || 0) + 1;

            // 定期重新分析频率（避免频繁计算）
            const now = new Date();
            if (!this.state.lastRecommendationUpdate ||
                (now - this.state.lastRecommendationUpdate) > (24 * 60 * 60 * 1000)) {
                this.analyzeUsageFrequency();
            }
        },

        // 缓存DOM元素
        cacheDomElements: function () {
            this.elements = {
                startAnimation: document.getElementById('start-animation'),
                container: document.querySelector('.container'),

                // 表单元素
                dateInput: document.getElementById('date'),
                sessionInput: document.getElementById('session'),
                classInput: document.getElementById('class'),
                courseInput: document.getElementById('course'),
                typeInput: document.getElementById('type'),
                recordsList: document.getElementById('records-list'),
                saveBtn: document.getElementById('save-btn'),
                clearFormBtn: document.getElementById('clear-form'), // 清空按钮


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
                tabContents: document.querySelectorAll('.tab-content'),
                //绑定清空所有记录按钮 
                clearAllBtn: document.getElementById('clear-all-records'),
            };

            // 设置默认日期为今天
            const today = new Date().toISOString().split('T')[0];
            this.elements.dateInput.value = today;
        },

        // 绑定事件
        bindEvents: function () {
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
            // 新增事件
            this.elements.clearFormBtn.addEventListener('click', this.clearForm.bind(this));

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
            //绑定清空所有记录按钮
            this.elements.clearAllBtn.addEventListener('click', this.clearAllRecords.bind(this));
        },

        // 显示启动动画
        showStartAnimation: function () {
            setTimeout(() => {
                this.elements.startAnimation.style.opacity = '0';
                setTimeout(() => {
                    this.elements.startAnimation.style.display = 'none';
                    this.elements.container.style.display = 'block';
                }, 500);
            }, 2000);
        },

        // 切换标签页
        switchTab: function (e) {
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
        loadData: function () {
            this.Storage.loadData((savedData) => {
                try {
                    this.state.records = JSON.parse(savedData) || [];
                    this.renderRecords();
                    this.updateTotalRecordsCount(); // 确保在这里更新总数
                    this.displayLastRecordInfo();   // 确保在这里显示最后一条记录
                    this.analyzeUsageFrequency();
                } catch (e) {
                    console.error("Error parsing data:", e);
                    this.state.records = [];
                    this.renderRecords();
                    this.updateTotalRecordsCount(); // 错误情况也更新总数
                    this.displayLastRecordInfo();    // 错误情况也显示最后一条记录
                }
            });
        },

        // 加载设置   
        loadSettings: function (callback) {
            this.Storage.loadSettings((savedSettings) => {
                try {
                    const parsedSettings = JSON.parse(savedSettings);
                    if (parsedSettings &&
                        Array.isArray(parsedSettings.classes) &&
                        Array.isArray(parsedSettings.courses) &&
                        Array.isArray(parsedSettings.types)) {
                        this.state.settings = parsedSettings;
                    } else {
                        this.state.settings = {
                            classes: [],
                            courses: [],
                            types: [],
                            ...this.config.defaultSettings
                        };
                    }
                } catch (e) {
                    console.error("Error parsing settings:", e);
                    this.state.settings = {
                        classes: [],
                        courses: [],
                        types: [],
                        ...this.config.defaultSettings
                    };
                }
                this.renderSettings();
                this.updateFormOptions();

                if (callback) callback();
            });
        },

        // 保存记录（增强版）
        saveRecord: async function () {
            try {
                // 验证必填字段
                if (!this.validateRequiredFields()) return;

                // 验证数据格式
                if (!this.validateFieldFormats()) return;

                // 检查重复记录
                if (await this.checkDuplicateRecord()) return;

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
                    this.state.currentPage = 1;
                    this.updateFrequencyStats(record); // 更新频率统计
                    // 新增：显示最新记录提示
                    this.showLatestRecordNotification(record);
                }

                // 保存并刷新
                this.Storage.saveData(JSON.stringify(this.state.records));
                this.renderRecords();
                this.resetForm();
                this.updateTotalRecordsCount(); // 更新记录总数

            } catch (error) {
                console.error("保存记录出错:", error);
                this.Dialog.alert("保存记录时出错: " + error.message);
            }
        },

        // 新增：显示最新记录提示
        showLatestRecordNotification: function (record) {
            const notification = document.createElement('div');
            notification.className = 'record-notification';
            notification.innerHTML = `
        <p>已添加: ${record.date} ${record.session} ${record.class} ${record.course}</p>
    `;

            const recordsContainer = document.querySelector('.records-container');
            recordsContainer.insertBefore(notification, recordsContainer.firstChild);

            // 3秒后自动消失
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        },

        // 新增：验证必填字段
        validateRequiredFields: function () {
            const requiredFields = [
                { field: this.elements.dateInput, name: '日期' },
                { field: this.elements.sessionInput, name: '节次' },
                { field: this.elements.classInput, name: '班级' },
                { field: this.elements.courseInput, name: '课程' },
                { field: this.elements.typeInput, name: '课型' }
            ];

            const missingFields = requiredFields.filter(item => !item.field.value);

            if (missingFields.length > 0) {
                this.Dialog.alert(`请填写以下字段: ${missingFields.map(f => f.name).join('、')}`);
                return false;
            }

            return true;
        },

        // 新增：验证字段格式
        validateFieldFormats: function () {
            const validations = [
                { field: this.elements.dateInput, rule: this.config.validationRules.date, name: '日期', example: 'YYYY-MM-DD' },
                { field: this.elements.sessionInput, rule: this.config.validationRules.session, name: '节次', example: '12节、34节、56节或晚自习' },
                { field: this.elements.classInput, rule: this.config.validationRules.class, name: '班级', example: '1-50个字符' },
                { field: this.elements.courseInput, rule: this.config.validationRules.course, name: '课程', example: '1-50个字符' },
                { field: this.elements.typeInput, rule: this.config.validationRules.type, name: '课型', example: '1-20个字符' }
            ];

            const invalidFields = validations.filter(item => !item.rule.test(item.field.value));

            if (invalidFields.length > 0) {
                const errorMsg = invalidFields.map(item =>
                    `${item.name}格式不正确，应为: ${item.example}`
                ).join('\n');

                this.Dialog.alert(errorMsg);
                return false;
            }

            return true;
        },

        // 修改 checkDuplicateRecord 方法
        checkDuplicateRecord: async function () {
            // 编辑现有记录时不检查重复
            if (this.state.editingId) return false;

            const date = this.elements.dateInput.value;
            const session = this.elements.sessionInput.value;

            const isDuplicate = this.state.records.some(record =>
                record.date === date &&
                record.session === session
            );

            if (isDuplicate) {
                const confirmed = await this.Dialog.confirm(
                    "已存在相同日期和节次的记录，确定要重复添加吗？"
                );
                return !confirmed; // 如果用户确认，返回false(不阻止保存)
            }

            return false;
        },

        // 新增：清空表单
        clearForm: async function () {
            try {
                // 如果表单有内容，需要确认
                if (this.elements.sessionInput.value || this.elements.classInput.value ||
                    this.elements.courseInput.value || this.elements.typeInput.value) {
                    const confirmed = await this.Dialog.confirm("确定要清空当前表单内容吗？");
                    if (!confirmed) return;
                }

                this.resetForm();
            } catch (error) {
                console.error("清空表单出错:", error);
                this.Dialog.alert("清空表单时出错: " + error.message);
            }
        },

        // 重置表单
        resetForm: function () {
            const today = new Date().toISOString().split('T')[0];
            this.elements.dateInput.value = today;
            this.elements.sessionInput.value = '';
            this.elements.classInput.value = '';
            this.elements.courseInput.value = '';
            this.elements.typeInput.value = '';
        },

        // 渲染记录列表
        renderRecords: function () {
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

            this.updateTotalRecordsCount(); // 确保在渲染结束时更新总数
        },

        // 删除记录
        deleteRecord: async function (e) {
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
        editRecord: function (e) {
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
        renderSettings: function () {
            this.renderSettingList('classes', this.elements.classList);
            this.renderSettingList('courses', this.elements.courseList);
            this.renderSettingList('types', this.elements.typeList);
        },

        // 渲染单个设置列表
        renderSettingList: function (settingKey, listElement) {
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
        updateFormOptions: function () {
            this.updateSelectOptions(this.elements.classInput, this.state.settings.classes);
            this.updateSelectOptions(this.elements.courseInput, this.state.settings.courses);
            this.updateSelectOptions(this.elements.typeInput, this.state.settings.types);
            this.updateSelectOptions(this.elements.statClassInput, this.state.settings.classes, true);
        },

        // 更新选择框选项
        updateSelectOptions: function (selectElement, options, includeAllOption = false) {
            // 确保options是数组
            if (!Array.isArray(options)) {
                options = [];
            }

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
        addSettingItem: function (settingKey, inputElement) {
            const value = inputElement.value.trim();
            if (value && !this.state.settings[settingKey].includes(value)) {
                this.state.settings[settingKey].push(value);
                inputElement.value = '';
                this.renderSettings();
                this.updateFormOptions();
            }
        },

        // 删除设置项
        deleteSettingItem: async function (e) {
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
        checkRecordsAfterDeletion: function (settingKey, deletedIndex) {
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
        saveSettings: function () {
            this.Storage.saveSettings(JSON.stringify(this.state.settings));
            this.Dialog.alert("设置已保存");
        },

        // ==================== 统计功能 ====================

        // 初始化统计页面
        initStatistics: function () {
            this.setDefaultDateRange();
            this.updateFormOptions();
        },

        // 设置默认日期范围（本月）
        setDefaultDateRange: function () {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

            this.elements.startDateInput.value = firstDay.toISOString().split('T')[0];
            this.elements.endDateInput.value = today.toISOString().split('T')[0];
        },

        // 生成统计数据
        generateStatistics: function () {
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
        renderStatistics: function (typeStats, records) {
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
        exportToExcel: function () {
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
                    { wch: 12 }, // 日期
                    { wch: 8 },  // 节次
                    { wch: 15 }, // 班级
                    { wch: 15 }, // 课程
                    { wch: 10 }, // 课型
                    { wch: 8 }  // 课时
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
        exportToPdf: async function () {
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
        initCharts: function () {
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
        renderCharts: function (timeRange) {
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
        getAxisTitle: function (timeRange) {
            switch (timeRange) {
                case 'week': return '日期';
                case 'month': return '周次';
                case 'year': return '月份';
                default: return '';
            }
        },

        // 获取图表标题
        getChartTitle: function (timeRange) {
            switch (timeRange) {
                case 'week': return '本周课时统计';
                case 'month': return '本月课时统计';
                case 'year': return '年度课时统计';
                default: return '课时统计';
            }
        },

        // 获取过滤后的记录
        getFilteredRecords: function (timeRange) {
            const today = new Date();
            let startDate = new Date();
            let groupByFunction;

            switch (timeRange) {
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
        backupData: function () {
            const data = localStorage.getItem('classRecords');
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'class_records_backup_' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();

            this.elements.backupStatus.textContent = '备份成功！';
            setTimeout(() => {
                this.elements.backupStatus.textContent = '';
            }, 3000);
        },

        // 恢复数据
        restoreData: function () {
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

        /**
        * 清空所有课时记录
        */
        clearAllRecords: async function () {
            try {
                // ...现有确认逻辑...

                // 执行清空
                this.state.records = [];
                this.state.currentPage = 1;
                this.Storage.saveData(JSON.stringify(this.state.records));
                this.renderRecords();
                this.updateTotalRecordsCount(); // 添加这行

                // 重置频率统计
                this.state.frequencyStats = {
                    classes: {},
                    courses: {},
                    types: {},
                    classCoursePairs: {},
                    courseTypePairs: {}
                };

                this.Dialog.alert("所有课时记录已清空！");
            } catch (error) {
                console.error("清空记录出错:", error);
                this.Dialog.alert("清空记录时出错: " + error.message);
            }
        },


        // ==================== 应用关闭 ====================

        // 处理关闭应用
        // 修改 handleCloseApp 方法
        handleCloseApp: function () {
            try {
                // 尝试调用Android接口
                if (window.android && typeof window.android.closeApp === 'function') {
                    window.android.closeApp();
                    return;
                }

                // 尝试调用iOS接口
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.closeApp) {
                    window.webkit.messageHandlers.closeApp.postMessage({});
                    return;
                }

                // 通用浏览器处理
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.close();
                }
            } catch (e) {
                console.error('关闭应用出错:', e);
                // 回退到最小化或隐藏界面
                try {
                    if (window.document.exitFullscreen) {
                        window.document.exitFullscreen();
                    } else if (window.document.webkitExitFullscreen) {
                        window.document.webkitExitFullscreen();
                    }
                } catch (err) {
                    console.error('退出全屏出错:', err);
                }
            }
        },

        // ==================== 工具方法 ====================

        // 存储工具
        // ==================== 存储工具 ====================
        Storage: {
            // 初始化IndexedDB
            initDB: function () {
                return new Promise((resolve, reject) => {
                    if (!('indexedDB' in window)) {
                        resolve(null); // 不支持IndexedDB
                        return;
                    }

                    const request = indexedDB.open('TeacherRecordSystemDB', 1);

                    request.onerror = (event) => {
                        console.error('IndexedDB打开失败:', event.target.error);
                        resolve(null); // 打开失败，回退
                    };

                    request.onsuccess = (event) => {
                        resolve(event.target.result); // 返回数据库实例
                    };

                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;

                        // 创建记录存储
                        if (!db.objectStoreNames.contains('records')) {
                            db.createObjectStore('records', { keyPath: 'id' });
                        }

                        // 创建设置存储
                        if (!db.objectStoreNames.contains('settings')) {
                            db.createObjectStore('settings', { keyPath: 'id' });
                        }
                    };
                });
            },

            // 获取数据库实例
            getDB: function () {
                if (!this.dbPromise) {
                    this.dbPromise = this.initDB();
                }
                return this.dbPromise;
            },

            // 通用IndexedDB操作
            idbOperation: async function (storeName, operation, data) {
                try {
                    const db = await this.getDB();
                    if (!db) return null; // 不支持IndexedDB

                    return new Promise((resolve, reject) => {
                        const transaction = db.transaction(storeName, 'readwrite');
                        const store = transaction.objectStore(storeName);

                        // 确保operation函数返回request对象
                        const request = operation(store, data);
                        if (!request) {
                            reject(new Error('操作未返回有效的请求对象'));
                            return;
                        }

                        request.onsuccess = () => resolve(request.result);
                        request.onerror = (event) => {
                            console.error('IndexedDB操作失败:', event.target.error);
                            reject(event.target.error);
                        };
                    });
                } catch (error) {
                    console.error('IndexedDB操作异常:', error);
                    return null;
                }
            },

            // 加载数据
            loadData: async function (callback) {
                // 优先尝试Android接口
                if (window.AndroidInterface) {
                    const data = AndroidInterface.loadData();
                    callback(data);
                    return;
                }

                try {
                    // 尝试使用IndexedDB
                    const db = await this.getDB();
                    if (db) {
                        const records = await this.idbOperation('records', (store) => {
                            return store.getAll();
                        });

                        if (records && records.length > 0) {
                            callback(JSON.stringify(records));
                            return;
                        }
                    }

                    // 回退到localStorage
                    console.log("回退到localStorage加载数据");
                    const savedData = localStorage.getItem('classRecords');
                    callback(savedData || '[]');

                    // 如果localStorage有数据而IndexedDB没有，则迁移数据
                    if (savedData && savedData !== '[]' && db) {
                        try {
                            const parsedData = JSON.parse(savedData);
                            await this.idbOperation('records', (store) => {
                                parsedData.forEach(record => {
                                    store.put(record);
                                });
                            });
                            console.log("数据从localStorage迁移到IndexedDB成功");
                        } catch (e) {
                            console.error("数据迁移失败:", e);
                        }
                    }
                } catch (error) {
                    console.error("加载数据出错:", error);
                    callback('[]');
                }
            },

            saveData: async function (data) {
                // 优先尝试Android接口
                if (window.AndroidInterface) {
                    AndroidInterface.saveData(data);
                    return;
                }

                try {
                    const parsedData = JSON.parse(data);

                    // 尝试使用IndexedDB
                    const db = await this.getDB();
                    if (db) {
                        await this.idbOperation('records', (store) => {
                            return new Promise((resolve, reject) => {
                                const clearRequest = store.clear();

                                clearRequest.onsuccess = () => {
                                    const requests = parsedData.map(record => {
                                        return new Promise((res, rej) => {
                                            const putRequest = store.put(record);
                                            putRequest.onsuccess = () => res();
                                            putRequest.onerror = (e) => rej(e.target.error);
                                        });
                                    });

                                    Promise.all(requests)
                                        .then(() => resolve())
                                        .catch(error => reject(error));
                                };

                                clearRequest.onerror = (e) => reject(e.target.error);
                            });
                        });

                        // 同时保存到localStorage作为备份
                        localStorage.setItem('classRecords', data);
                        return;
                    }

                    // 回退到localStorage
                    console.log("回退到localStorage保存数据");
                    localStorage.setItem('classRecords', data);
                } catch (error) {
                    console.error("保存数据出错:", error);
                }
            },


            loadSettings: async function (callback) {
                // 优先尝试Android接口
                if (window.AndroidInterface) {
                    const settings = AndroidInterface.loadSettings();
                    callback(settings);
                    return;
                }

                try {
                    // 尝试使用IndexedDB
                    const db = await this.getDB();
                    if (db) {
                        const settings = await this.idbOperation('settings', (store) => {
                            return store.get('appSettings'); // 确保返回request对象
                        });

                        if (settings) {
                            callback(JSON.stringify(settings.value));
                            return;
                        }
                    }

                    // 回退到localStorage
                    console.log("回退到localStorage加载设置");
                    const savedSettings = localStorage.getItem('classSettings');
                    callback(savedSettings || '{"classes":[],"courses":[],"types":[]}');

                    // 如果localStorage有设置而IndexedDB没有，则迁移设置
                    if (savedSettings && savedSettings !== '{"classes":[],"courses":[],"types":[]}' && db) {
                        try {
                            await this.idbOperation('settings', (store) => {
                                return store.put({ // 确保返回request对象
                                    id: 'appSettings',
                                    value: JSON.parse(savedSettings)
                                });
                            });
                            console.log("设置从localStorage迁移到IndexedDB成功");
                        } catch (e) {
                            console.error("设置迁移失败:", e);
                        }
                    }
                } catch (error) {
                    console.error("加载设置出错:", error);
                    callback('{"classes":[],"courses":[],"types":[]}');
                }
            },

            saveSettings: async function (settings) {
                // 优先尝试Android接口
                if (window.AndroidInterface) {
                    AndroidInterface.saveSettings(settings);
                    return;
                }

                try {
                    const parsedSettings = JSON.parse(settings);

                    // 尝试使用IndexedDB
                    const db = await this.getDB();
                    if (db) {
                        await this.idbOperation('settings', (store) => {
                            store.put({
                                id: 'appSettings',
                                value: parsedSettings
                            });
                        });

                        // 同时保存到localStorage作为备份
                        localStorage.setItem('classSettings', settings);
                        return;
                    }

                    // 回退到localStorage
                    console.log("回退到localStorage保存设置");
                    localStorage.setItem('classSettings', settings);
                } catch (error) {
                    console.error("保存设置出错:", error);
                }
            }
        },

        // 对话框工具
        Dialog: {
            // 检测运行环境
            isAndroidWebView: () => !!window.AndroidBridge,
            isIOS: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),

            // 确认对话框
            confirm: function (message) {
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
            alert: function (message) {
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
    document.addEventListener('DOMContentLoaded', function () {
        TeacherRecordSystem.init();
    });

})(window, document);