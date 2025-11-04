const supabase = require("../config/supabase");
const { validationResult } = require("express-validator");

const wishlistController = {
  getWishlist: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("wishlists")
        .select(
          `
          *,
          products (
            id, name, description, image_urls, sku, average_rating, total_ratings,
            brands (brand_name),
            product_types (type_name),
            product_variants (*, sizes (size_name))
          )
        `
        )
        .eq("user_id", userId)
        .eq("products.is_active", true)
        .order("added_at", { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addToWishlist: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { product_id } = req.body;

      // Verify product exists
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", product_id)
        .eq("is_active", true)
        .single();

      if (productError) throw productError;
      if (!product) return res.status(404).json({ error: "Product not found" });

      // Check if product is already in wishlist
      const { data: existing, error: existingError } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", product_id)
        .single();

      if (existingError && existingError.code !== "PGRST116")
        throw existingError;
      if (existing)
        return res.status(400).json({ error: "Product already in wishlist" });

      // Add to wishlist
      const { data, error } = await supabase
        .from("wishlists")
        .insert([{ user_id: userId, product_id, added_at: new Date() }])
        .select(
          `
          *,
          products (
            id, name, description, image_urls, sku, average_rating, total_ratings,
            brands (brand_name),
            product_types (type_name)
          )
        `
        )
        .single();

      if (error) throw error;

      // Log audit action
      await supabase.from("audit_logs").insert([
        {
          table_name: "wishlists",
          record_id: data.id,
          action: "INSERT",
          new_values: { user_id: userId, product_id },
          user_id: userId,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
        },
      ]);

      // Create notification
      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "wishlist_added")
        .single();

      if (typeError && typeError.code !== "PGRST116") throw typeError;

      let typeId = notificationType?.id;
      if (!typeId) {
        const { data: newType, error: newTypeError } = await supabase
          .from("notification_types")
          .insert([
            {
              type_name: "wishlist_added",
              display_name: "Product Added to Wishlist",
              is_active: true,
            },
          ])
          .select()
          .single();
        if (newTypeError) throw newTypeError;
        typeId = newType.id;
      }

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            type_id: typeId,
            title: "Product Added to Wishlist",
            content: `You added ${data.products.name} to your wishlist.`,
            target_type: "user",
            target_value: userId,
            created_by: userId,
            action_url: `/products/${product_id}`,
          },
        ]);

      if (notificationError) throw notificationError;

      const { error: userNotificationError } = await supabase
        .from("user_notifications")
        .insert([
          {
            notification_id: supabase
              .from("notifications")
              .select("id")
              .order("created_at", { ascending: false })
              .limit(1),
            user_id: userId,
          },
        ]);

      if (userNotificationError) throw userNotificationError;

      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  removeFromWishlist: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { data: wishlistItem, error: fetchError } = await supabase
        .from("wishlists")
        .select("id, product_id, products (name)")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (fetchError) throw fetchError;
      if (!wishlistItem)
        return res.status(404).json({ error: "Wishlist item not found" });

      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      // Log audit action
      await supabase.from("audit_logs").insert([
        {
          table_name: "wishlists",
          record_id: id,
          action: "DELETE",
          old_values: { user_id: userId, product_id: wishlistItem.product_id },
          user_id: userId,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
        },
      ]);

      // Create notification
      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "wishlist_removed")
        .single();

      if (typeError && typeError.code !== "PGRST116") throw typeError;

      let typeId = notificationType?.id;
      if (!typeId) {
        const { data: newType, error: newTypeError } = await supabase
          .from("notification_types")
          .insert([
            {
              type_name: "wishlist_removed",
              display_name: "Product Removed from Wishlist",
              is_active: true,
            },
          ])
          .select()
          .single();
        if (newTypeError) throw newTypeError;
        typeId = newType.id;
      }

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            type_id: typeId,
            title: "Product Removed from Wishlist",
            content: `You removed ${wishlistItem.products.name} from your wishlist.`,
            target_type: "user",
            target_value: userId,
            created_by: userId,
          },
        ]);

      if (notificationError) throw notificationError;

      const { error: userNotificationError } = await supabase
        .from("user_notifications")
        .insert([
          {
            notification_id: supabase
              .from("notifications")
              .select("id")
              .order("created_at", { ascending: false })
              .limit(1),
            user_id: userId,
          },
        ]);

      if (userNotificationError) throw userNotificationError;

      res.json({ message: "Product removed from wishlist" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllWishlists: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("wishlists")
        .select(
          `
          *,
          user_profiles (full_name, email),
          products (name, sku, brands (brand_name), product_types (type_name))
        `
        )
        .order("added_at", { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = wishlistController;
