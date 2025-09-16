export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { GITHUB_OWNER, GITHUB_REPO, GITHUB_LABELS, GITHUB_TOKEN } = process.env;

        if (!GITHUB_OWNER || !GITHUB_REPO) {
            return res.status(500).json({ error: "GitHub 配置缺失，请检查环境变量" });
        }

        const labelsParam = GITHUB_LABELS ? `&labels=${encodeURIComponent(GITHUB_LABELS)}` : "";
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=all&per_page=100${labelsParam}`;

        const headers = {
            "Accept": "application/vnd.github.v3+json",
        };

        if (GITHUB_TOKEN) {
            headers["Authorization"] = `token ${GITHUB_TOKEN}`;
        }

        const githubRes = await fetch(url, { headers });

        if (!githubRes.ok) {
            const errorText = await githubRes.text();
            return res.status(githubRes.status).json({ error: errorText });
        }

        const issues = await githubRes.json();

        // 返回前端只需要的字段，避免太冗余
        const simplifiedIssues = issues.map(issue => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            body: issue.body,
            html_url: issue.html_url,
            created_at: issue.created_at,
            labels: issue.labels.map(l => l.name),
        }));

        return res.status(200).json(simplifiedIssues);
    } catch (err) {
        console.error("拉取 GitHub Issues 失败:", err);
        return res.status(500).json({ error: "服务器错误" });
    }
}
