const supabase = require("../config/supabase");
const { validationResult } = require("express-validator");

const authController = {
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        email,
        password,
        full_name,
        phone_number,
        gender,
        date_of_birth,
      } = req.body;

      // Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name, phone_number, gender, date_of_birth },
        },
      });

      if (authError) throw authError;

      // Create user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .insert([
          {
            id: authData.user.id,
            full_name,
            phone_number,
            gender,
            date_of_birth,
            role: "user",
            registration_source: "api",
          },
        ])
        .select()
        .single();

      if (profileError) throw profileError;

      // Initialize user rank
      const { data: rank, error: rankError } = await supabase
        .from("user_ranks")
        .insert([
          { user_id: authData.user.id, current_points: 0, lifetime_points: 0 },
        ])
        .select()
        .single();

      if (rankError) throw rankError;

      res
        .status(201)
        .json({
          user: authData.user,
          profile,
          token: authData.session.access_token,
        });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      res.json({ user: data.user, profile, token: data.session.access_token });
    } catch (error) {
      res.status(401).json({ error: "Invalid credentials: " + error.message });
    }
  },
};

module.exports = authController;
