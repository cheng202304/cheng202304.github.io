document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('generate-btn').addEventListener('click', generateTestData);
});

function generateTestData() {
    // 清除现有数据
    localStorage.removeItem('classRecords');
    
    const classes = ['24秋电商一', '24秋电商二', '23春电商一', '23春电商二'];
    const courses = ['电子商务网站建设与维护', '网页设计', '网络营销', '数据库原理'];
    const types = ['理论课', '实践课', '考前辅导', '复习课'];
    const sessions = ['12节', '34节', '56节', '78节'];
    
    const currentYear = new Date().getFullYear();
    const records = [];
    let totalHours = 0;
    
    // 生成24个月内分布的数据
    for (let month = 0; month < 24; month++) {
        const year = currentYear + Math.floor(month / 12);
        const monthInYear = (month % 12) + 1;
        
        // 每月生成约42条记录，总计约1000条
        for (let i = 0; i < 42 && totalHours < 100; i++) {
            const day = Math.floor(Math.random() * 28) + 1;
            const date = `${year}-${monthInYear.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            records.push({
                id: Date.now() + totalHours,
                date: date,
                session: sessions[Math.floor(Math.random() * sessions.length)],
                class: classes[Math.floor(Math.random() * classes.length)],
                course: courses[Math.floor(Math.random() * courses.length)],
                type: types[Math.floor(Math.random() * types.length)]
            });
            
            totalHours++;
        }
    }
    
    // 按日期和节次排序
    records.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.session.localeCompare(b.session);
    });
    
    localStorage.setItem('classRecords', JSON.stringify(records));
    
    // 创建下载链接
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataStr);
    downloadLink.setAttribute('download', `classRecords_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    alert('已生成1000条随机测试数据并下载JSON文件');
    location.reload();
}