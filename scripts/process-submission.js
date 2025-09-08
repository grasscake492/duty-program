const fs = require('fs');
const path = require('path');

// 解析GitHub事件数据
const eventData = JSON.parse(process.argv[2]);
const submissionsFile = path.join(__dirname, '../data/submissions.json');

function extractJsonData(text) {
    const match = text.match(/<!-- JSON_DATA -->([\s\S]*?)<!-- END_JSON_DATA -->/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1].trim());
        } catch (e) {
            console.error('JSON解析错误:', e);
        }
    }
    return null;
}

// 处理提交数据
function processSubmission(event) {
    let submissionData;

    if (event.discussion) {
        // 从Discussions提取数据
        submissionData = extractJsonData(event.discussion.body);
    } else if (event.issue) {
        // 从Issues提取数据
        submissionData = extractJsonData(event.issue.body);
    }

    if (!submissionData) {
        console.log('未找到有效数据');
        return;
    }

    // 读取现有数据
    let allSubmissions = [];
    if (fs.existsSync(submissionsFile)) {
        const existingData = fs.readFileSync(submissionsFile, 'utf8');
        allSubmissions = JSON.parse(existingData);
    }

    // 添加新数据
    allSubmissions.push({
        ...submissionData,
        id: Date.now().toString(),
        processedAt: new Date().toISOString()
    });

    // 保存数据
    fs.writeFileSync(submissionsFile, JSON.stringify(allSubmissions, null, 2));
    console.log('数据已保存');
}

// 执行处理
processSubmission(eventData);

