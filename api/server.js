export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { username, password } = req.body;

    // 写死管理员账号和密码
    const ADMIN_USER = "kamukura";
    const ADMIN_PASS = "PANN0101";

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.status(200).json({ success: true });
    } else {
        res.status(200).json({ success: false });
    }
}
