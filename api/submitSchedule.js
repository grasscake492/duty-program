// api/submitSchedule.js (Vercel)

export default async function handler(req, res) {
    // 允许跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, phone, availability } = req.body;

        // 1. 数据验证
        if (!name || !phone || !availability) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 2. 准备提交到 GitHub Issue 的数据
        const issueTitle = `排班提交: ${name} (${phone})`;
        const issueBody = `
## 排班信息提交

**姓名:** ${name}
**手机:** ${phone}

**可用时间:**
${availability.map(slot => `- ${slot.day} ${slot.time}`).join('\n')}

<!-- 原始数据 -->
\`\`\`json
${JSON.stringify({ name, phone, availability }, null, 2)}
\`\`\`
    `.trim();

        // 3. 调用 GitHub API
        const githubApiUrl = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/issues`;
        const response = await fetch(githubApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody,
                labels: ['scheduling', 'submission'],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub API error:', response.status, errorText);
            throw new Error(`Failed to create issue: ${response.status}`);
        }

        const issueData = await response.json();

        // 4. 返回成功信息给前端
        res.status(200).json({
            success: true,
            message: '提交成功！',
            issueUrl: issueData.html_url,
        });

    } catch (error) {
        console.error('Serverless function error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error. Please try again later.',
        });
    }
}