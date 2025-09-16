export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { GITHUB_OWNER, GITHUB_REPO, GITHUB_LABELS, GITHUB_TOKEN } = process.env;

        if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ error: "GitHub 配置缺失，请检查环境变量" });
        }

        const { name, phone, availability } = req.body;

        if (!name || !phone || !availability) {
            return res.status(400).json({ error: "缺少必要字段 (name, phone, availability)" });
        }


        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;

        // 组装 Issue 内容
        const issueBody = `
**姓名**: ${name}
**电话**: ${phone}
**有空时间段**: ${timeslot}
    `.trim();

        const newIssue = {
            title: `排班提交 - ${name}`,
            body: issueBody,
            labels: GITHUB_LABELS ? GITHUB_LABELS.split(",").map(l => l.trim()) : ["scheduling"],
        };

        const githubRes = await fetch(url, {
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
        return res.status(200).json({
            success: true,
            url: createdIssue.html_url,
            number: createdIssue.number,
        });
    } catch (err) {
        console.error("创建 GitHub Issue 失败:", err);
        return res.status(500).json({ error: "服务器错误" });
    }
}
