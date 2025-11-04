const supabase = require("../config/supabase");
const { validationResult } = require("express-validator");

const userController = {
  getProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Profile not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { full_name, phone_number, gender, date_of_birth, avatar_url } =
        req.body;

      const { data, error } = await supabase
        .from("user_profiles")
        .update({
          full_name,
          phone_number,
          gender,
          date_of_birth,
          avatar_url,
          updated_at: new Date(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Profile not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAddresses: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*, addresses (*, locations (latitude, longitude))")
        .eq("user_id", userId);

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addAddress: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const {
        street,
        ward,
        district,
        province,
        receiver_name,
        receiver_phone,
        is_default,
        latitude,
        longitude,
      } = req.body;

      // Insert address
      const { data: address, error: addressError } = await supabase
        .from("addresses")
        .insert([
          { street, ward, district, province, receiver_name, receiver_phone },
        ])
        .select()
        .single();

      if (addressError) throw addressError;

      // Insert location if provided
      let locationId = null;
      if (latitude && longitude) {
        const { data: location, error: locationError } = await supabase
          .from("locations")
          .insert([{ latitude, longitude }])
          .select()
          .single();
        if (locationError) throw locationError;
        locationId = location.id;

        // Update address with location_id
        await supabase
          .from("addresses")
          .update({ location_id: locationId })
          .eq("id", address.id);
      }

      // Insert user_address
      const { data: userAddress, error: userAddressError } = await supabase
        .from("user_addresses")
        .insert([{ user_id: userId, address_id: address.id, is_default }])
        .select()
        .single();

      if (userAddressError) throw userAddressError;

      // If is_default is true, update other addresses
      if (is_default) {
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", userId)
          .neq("id", userAddress.id);
      }

      res.status(201).json({ ...userAddress, address });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateAddress: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const {
        street,
        ward,
        district,
        province,
        receiver_name,
        receiver_phone,
        is_default,
        latitude,
        longitude,
      } = req.body;

      // Verify address belongs to user
      const { data: userAddress, error: userAddressError } = await supabase
        .from("user_addresses")
        .select("address_id")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (userAddressError) throw userAddressError;
      if (!userAddress)
        return res.status(404).json({ error: "Address not found" });

      // Update address
      const { data: address, error: addressError } = await supabase
        .from("addresses")
        .update({
          street,
          ward,
          district,
          province,
          receiver_name,
          receiver_phone,
        })
        .eq("id", userAddress.address_id)
        .select()
        .single();

      if (addressError) throw addressError;

      // Update location if provided
      if (latitude && longitude) {
        const { data: location, error: locationError } = await supabase
          .from("locations")
          .upsert([
            { id: address.location_id || undefined, latitude, longitude },
          ])
          .select()
          .single();
        if (locationError) throw locationError;

        await supabase
          .from("addresses")
          .update({ location_id: location.id })
          .eq("id", address.id);
      }

      // Update user_address
      const { data: updatedUserAddress, error: updateError } = await supabase
        .from("user_addresses")
        .update({ is_default, updated_at: new Date() })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      // If is_default is true, update other addresses
      if (is_default) {
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", userId)
          .neq("id", id);
      }

      res.json({ ...updatedUserAddress, address });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteAddress: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { data: userAddress, error: userAddressError } = await supabase
        .from("user_addresses")
        .select("address_id")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (userAddressError) throw userAddressError;
      if (!userAddress)
        return res.status(404).json({ error: "Address not found" });

      // Soft delete address
      await supabase
        .from("addresses")
        .update({ is_active: false })
        .eq("id", userAddress.address_id);

      // Delete user_address
      await supabase.from("user_addresses").delete().eq("id", id);

      res.json({ message: "Address deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getRank: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("user_ranks")
        .select("*, rank_levels (name, min_points, max_points, benefits)")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Rank not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getVouchers: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("user_vouchers")
        .select(
          "*, vouchers (code, name, description, type, value, valid_from, valid_to)"
        )
        .eq("user_id", userId)
        .eq("is_used", false)
        .gte("vouchers.valid_to", new Date().toISOString());

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("user_notifications")
        .select(
          "*, notifications (title, content, action_url, type_id, notification_types (type_name, display_name))"
        )
        .eq("user_id", userId)
        .eq("is_dismissed", false)
        .order("delivered_at", { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  markNotificationRead: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { data, error } = await supabase
        .from("user_notifications")
        .update({ is_read: true, read_at: new Date() })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      if (!data)
        return res.status(404).json({ error: "Notification not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllUsers: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*, user_ranks (current_points, rank_levels (name))");

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateUserRole: async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .update({ role, updated_at: new Date() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "User not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = userController;
