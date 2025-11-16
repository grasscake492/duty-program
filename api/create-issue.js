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

        // 检查必填字段
        if (!name || !phone || !availability || !Array.isArray(availability) || availability.length === 0 || !role) {
            return res.status(400).json({ error: "缺少必要字段 (name, phone, availability, role)" });
        }

        // 检查重复提交
        const existingSubmission = await checkForDuplicateSubmission(name, phone, availability);
        if (existingSubmission) {
            return res.status(400).json({
                error: "检测到相同的提交（相同姓名、电话和空闲时间段）。请检查并避免重复提交。"
            });
        }

        // 角色对应 GitHub 标签
        const roleLabel = role === "intern" ? "实习" : "中高级";

        const issueBody = JSON.stringify({
            name,
            phone,
            role, // 新增，直接写入 JSON
            availability,
            timestamp: new Date().toISOString()
        });

        const newIssue = {
            title: `排班提交 - ${name}`,
            body: issueBody,
            labels: [
                ...(GITHUB_LABELS ? GITHUB_LABELS.split(",").map(l => l.trim()) : ["scheduling"]),
                roleLabel // 区分身份
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

// 检查是否有重复提交（根据 name, phone 和 availability）
async function checkForDuplicateSubmission(name, phone, availability) {
    // 拉取 GitHub 中现有的 issues，检查是否存在相同的提交
    try {
        const response = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/issues?labels=scheduling`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`
                }
            }
        );
        const issues = await response.json();

        // 遍历所有 issues 检查是否存在完全相同的记录
        for (const issue of issues) {
            try {
                const issueData = JSON.parse(issue.body);
                const isDuplicate = issueData.name === name &&
                    issueData.phone === phone &&
                    JSON.stringify(issueData.availability) === JSON.stringify(availability);

                if (isDuplicate) {
                    console.log(`找到重复提交: ${name} (${phone})`);
                    return true; // 存在重复提交
                }
            } catch (err) {
                console.error("解析 GitHub issue.body 失败:", err);
            }
        }

        return false; // 没有重复提交
    } catch (err) {
        console.error("检查 GitHub 提交失败:", err);
        return false;
    }
}
