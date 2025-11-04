const supabase = require("../config/supabase");

const productController = {
  getProducts: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (brand_name),
          product_types (type_name),
          product_variants (*, sizes (size_name))
        `
        )
        .eq("is_active", true);

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getProductById: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (brand_name),
          product_types (type_name),
          product_variants (*, sizes (size_name)),
          product_ratings (*)
        `
        )
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Product not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createProduct: async (req, res) => {
    // Add role-based access control for admin
    try {
      const { name, description, brand_id, type_id, sku, price, ...rest } =
        req.body;
      const { data, error } = await supabase
        .from("products")
        .insert([{ name, description, brand_id, type_id, sku, ...rest }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateProduct: async (req, res) => {
    // Add role-based access control for admin
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from("products")
        .update(req.body)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Product not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteProduct: async (req, res) => {
    // Add role-based access control for admin
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Product not found" });
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = productController;
