import ProductForm from "@/components/products/ProductForm";

export default async function EditProductPage({ params }) {
  const { id } = await params;
  return <ProductForm productId={id} />;
}