// 直接使用您原有的完整代码
export default async function handler(req, res) {
    // 设置CORS头部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 只处理POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // Vercel中req.body已经是解析好的对象
        const { name, phone, availability, timestamp } = req.body;

        // 数据验证
        if (!name || !phone || !availability) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, phone, or availability'
            });
        }

        // 验证availability是数组且不为空
        if (!Array.isArray(availability) || availability.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Availability must be a non-empty array'
            });
        }

        // 检查环境变量
        const { GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN } = process.env;
        if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({
                success: false,
                error: 'GitHub configuration missing. Please check environment variables.'
            });
        }

        // 构建Issue内容
        const issueTitle = `排班提交: ${name} (${phone})`;
        const issueBody = `
## 排班信息提交

**姓名:** ${name}
**手机:** ${phone}
**提交时间:** ${timestamp ? new Date(timestamp).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN')}

### 可用时间段
${availability.map(slot => `- ${slot.day} ${slot.time}`).join('\n')}

### 原始数据
\`\`\`json
${JSON.stringify(req.body, null, 2)}
\`\`\`
        `.trim();

        // GitHub API URL
        const githubApiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;

        // 调用GitHub API创建Issue
        const githubResponse = await fetch(githubApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Serverless-Function'
            },
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody,
                labels: ['scheduling', 'submission']
            })
        });

        if (!githubResponse.ok) {
            const errorText = await githubResponse.text();
            console.error('GitHub API error:', githubResponse.status, errorText);
            throw new Error(`GitHub API request failed: ${githubResponse.status}`);
        }

        const issueData = await githubResponse.json();

        // 返回成功信息给前端
        res.status(200).json({
            success: true,
            message: 'Issue created successfully',
            issueUrl: issueData.html_url,
            issueNumber: issueData.number
        });

    } catch (error) {
        console.error('Error in create-issue API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}