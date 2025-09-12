// api/create-issue.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, phone, availability, time } = req.body;

        if (!name || !phone || !availability || !Array.isArray(availability)) {
            return res.status(400).json({ error: '提交数据不完整或格式错误' });
        }

        const token = process.env.GITHUB_TOKEN;
        const owner = "grasscake492";
        const repo = "duty-program";

        const issueTitle = `排班提交 - ${name}`;
        const issueBody = `
**姓名**: ${name}
**电话**: ${phone}
**可用时间**:
${availability.map(t => `- ${t.day} ${t.time}`).join("\n")}
**提交时间**: ${time}
    `;

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json",
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody,
                labels: ["scheduling", "submission"]
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("GitHub API错误:", result);
            return res.status(response.status).json({ error: result.message || 'GitHub API调用失败' });
        }

        res.status(200).json({ success: true, issueUrl: result.html_url });

    } catch (err) {
        console.error("后端异常:", err);
        res.status(500).json({ error: err.message });
    }
}
