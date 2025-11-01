export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { GITHUB_OWNER, GITHUB_REPO, GITHUB_LABELS, GITHUB_TOKEN } = process.env;

        if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ error: "GitHub 配置缺失，请检查环境变量" });
        }

        const { name, phone, availability, role } = req.body;

        // ✅ 现在 role 为必需字段
        if (!name || !phone || !availability || !Array.isArray(availability) || availability.length === 0 || !role) {
            return res.status(400).json({ error: "缺少必要字段 (name, phone, availability, role)" });
        }

        // ✅ 角色对应 GitHub 标签（可见效果更好）
        const roleLabel = role === "intern" ? "实习" : "中高级";

        const issueBody = JSON.stringify({
            name,
            phone,
            role, // ✅ 新增，直接写入 JSON
            availability,
            timestamp: new Date().toISOString()
        });

        const newIssue = {
            title: `排班提交 - ${name}`,
            body: issueBody,
            labels: [
                ...(GITHUB_LABELS ? GITHUB_LABELS.split(",").map(l => l.trim()) : ["scheduling"]),
                roleLabel // ✅ 区分身份
            ],
        };

        const githubRes = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
            {
                method: "POST",
                headers: {
                    "Accept": "application/vnd.github.v3+json",
                    "Authorization": `token ${GITHUB_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newIssue),
            }
        );

        if (!githubRes.ok) {
            const errorText = await githubRes.text();
            return res.status(githubRes.status).json({ error: errorText });
        }

        const createdIssue = await githubRes.json();

        return res.status(200).json({
            success: true,
            issueUrl: createdIssue.html_url,
            number: createdIssue.number
        });

    } catch (err) {
        console.error("创建 GitHub Issue 失败:", err);
        return res.status(500).json({ error: "服务器错误" });
    }
}
