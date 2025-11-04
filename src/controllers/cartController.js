const supabase = require("../config/supabase");

const cartController = {
  getCart: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("carts")
        .select(
          `
          *,
          cart_items (
            *,
            products (name, image_urls),
            product_variants (color, sku, size: sizes (size_name))
          )
        `
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (error) throw error;
      res.json(data || { items: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addToCart: async (req, res) => {
    try {
      const userId = req.user.id;
      const { product_id, variant_id, quantity } = req.body;

      // Check if cart exists, create if not
      let { data: cart, error: cartError } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (!cart) {
        const { data: newCart, error: newCartError } = await supabase
          .from("carts")
          .insert([{ user_id: userId, status: "active" }])
          .select()
          .single();
        if (newCartError) throw newCartError;
        cart = newCart;
      }

      // Add item to cart
      const { data, error } = await supabase
        .from("cart_items")
        .insert([{ cart_id: cart.id, product_id, variant_id, quantity }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateCartItem: async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const userId = req.user.id;

      const { data, error } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("id", id)
        .match({
          cart_id: supabase.from("carts").select("id").eq("user_id", userId),
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Cart item not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  removeFromCart: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { data, error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", id)
        .match({
          cart_id: supabase.from("carts").select("id").eq("user_id", userId),
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Cart item not found" });
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = cartController;
