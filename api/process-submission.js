// api/process-submission.js (适用于Vercel)
export default async function handler(req, res) {
    // 设置CORS头部，允许前端跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: '只允许POST请求'
        });
    }

    try {
        // 1. 从请求体中获取数据
        const { name, phone, availability } = req.body;

        // 2. 验证必需字段
        if (!name || !phone || !availability) {
            return res.status(400).json({
                success: false,
                error: '缺少必需字段：姓名、手机号或可用时间'
            });
        }

        // 3. 验证手机号格式（简单验证）
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                error: '手机号格式不正确'
            });
        }

        console.log('收到排班提交:', { name, phone, availability });

        // 4. 准备GitHub Issue数据
        const issueTitle = `排班提交: ${name} (${phone})`;
        const issueBody = `
## 排班信息提交

**姓名:** ${name}
**手机:** ${phone}
**提交时间:** ${new Date().toLocaleString('zh-CN')}

### 可用时间段
${availability.map(slot => `- ${slot.day} ${slot.time}`).join('\n')}

### 原始数据
\`\`\`json
${JSON.stringify({
            name,
            phone,
            availability,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent']
        }, null, 2)}
\`\`\`
    `.trim();

        // 5. 调用GitHub API创建Issue
        const GITHUB_OWNER = process.env.GITHUB_OWNER;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
            throw new Error('GitHub配置信息未设置');
        }

        const githubResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Scheduling-System-App'
                },
                body: JSON.stringify({
                    title: issueTitle,
                    body: issueBody,
                    labels: ['scheduling', 'submission']
                })
            }
        );

        if (!githubResponse.ok) {
            const errorData = await githubResponse.text();
            console.error('GitHub API错误:', githubResponse.status, errorData);
            throw new Error(`GitHub API请求失败: ${githubResponse.status}`);
        }

        const issueData = await githubResponse.json();

        // 6. 返回成功响应
        res.status(200).json({
            success: true,
            message: '排班信息提交成功！',
            issueUrl: issueData.html_url,
            issueNumber: issueData.number,
            data: {
                name,
                phone,
                availabilityCount: availability.length
            }
        });

    } catch (error) {
        console.error('处理提交时出错:', error);

        // 7. 返回错误响应
        res.status(500).json({
            success: false,
            error: '服务器内部错误',
            message: process.env.NODE_ENV === 'development' ? error.message : '请稍后重试'
        });
    }
}