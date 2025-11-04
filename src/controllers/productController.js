const supabase = require("../config/supabase");

const productController = {
  getProducts: async (req, res) => {
    try {
      // Extract pagination parameters from query (default: page=1, limit=10)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          brands (brand_name, image_url),
          product_types (
            type_name,
            image_url,
            parent: product_types (type_name)
          ),
          price: product_price_history (price, effective_date, end_date),
          discounts: product_discounts (name, discount_percentage, discount_amount, start_date, end_date),
          variants: product_variants (
            *,
            size: sizes (size_name),
            images: product_variant_images (image_url, sort_order)
          ),
          inventory (quantity, reserved_quantity, branch_id)
        `
        )
        .eq("is_active", true)
        .eq("price.is_active", true)
        .or("end_date.is.null,end_date.gt.now()", {
          foreignTable: "price",
        })
        .or("is_active.is.null,is_active.eq.true", {
          foreignTable: "discounts",
        })
        .or("end_date.is.null,end_date.gt.now()", {
          foreignTable: "discounts",
        })
        // Pagination
        .range(start, end)
        // Optional: Order by a field, e.g., created_at
        .order("created_at", { ascending: false });

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
          brands (brand_name, image_url),
          product_types (
            type_name,
            image_url,
            parent: product_types (type_name)
          ),
          price: product_price_history (price, effective_date, end_date),
          discounts: product_discounts (name, discount_percentage, discount_amount, start_date, end_date),
          variants: product_variants (
            *,
            size: sizes (size_name),
            images: product_variant_images (image_url, sort_order)
          ),
          inventory (quantity, reserved_quantity, branch_id),
          ratings: product_ratings (
            rating,
            title,
            comment,
            images,
            pros,
            cons,
            is_verified_purchase,
            is_anonymous,
            is_approved,
            helpful_count,
            replied_at,
            reply_content
          )
        `
        )
        .eq("id", id)
        .eq("is_active", true)
        .eq("price.is_active", true)
        .or("end_date.is.null,end_date.gt.now()", {
          foreignTable: "price",
        })
        .or("is_active.is.null,is_active.eq.true", {
          foreignTable: "discounts",
        })
        .or("end_date.is.null,end_date.gt.now()", {
          foreignTable: "discounts",
        })
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Product not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = productController;
