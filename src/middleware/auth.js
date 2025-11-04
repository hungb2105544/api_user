const supabase = require("../config/supabase");

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error) throw error;
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    req.user = { ...user, role: profile.role };
    next();
  } catch (error) {
    res.status(401).json({ error: "Authentication failed: " + error.message });
  }
};

const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
