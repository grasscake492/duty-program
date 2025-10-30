export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { GITHUB_OWNER, GITHUB_REPO, GITHUB_LABELS, GITHUB_TOKEN } = process.env;

        // 检查必要环境变量
        if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ error: "GitHub 配置缺失，请检查环境变量" });
        }

        // 解构前端提交的数据
        const { name, phone, availability } = req.body;

        if (!name || !phone || !availability || !Array.isArray(availability) || availability.length === 0) {
            return res.status(400).json({ error: "缺少必要字段 (name, phone, availability)" });
        }

        // === 关键改动：直接保存 JSON 格式，保持和前端一致 ===
        const issueBody = JSON.stringify({
            name,
            phone,
            availability,                 // 保持数组形式
            timestamp: new Date().toISOString()  // 前端生成表格时会用到
        });

        const newIssue = {
            title: `排班提交 - ${name}`,
            body: issueBody,
            labels: GITHUB_LABELS ? GITHUB_LABELS.split(",").map(l => l.trim()) : ["scheduling"],
        };

        // 提交到 GitHub API
        const githubRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(newIssue),
        });

        if (!githubRes.ok) {
            const errorText = await githubRes.text();
            return res.status(githubRes.status).json({ error: errorText });
        }

        const createdIssue = await githubRes.json();

        // 返回前端使用的字段
        return res.status(200).json({
            success: true,
            issueUrl: createdIssue.html_url, // 对应前端 window.open(result.issueUrl)
            number: createdIssue.number,
        });

    } catch (err) {
        console.error("创建 GitHub Issue 失败:", err);
        return res.status(500).json({ error: "服务器错误" });
    }
}
