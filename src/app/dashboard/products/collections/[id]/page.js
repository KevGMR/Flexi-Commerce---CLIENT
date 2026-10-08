import CollectionForm from "@/components/collections/CollectionForm";

export default async function EditCollectionPage({ params }) {
  const { id } = await params;
  return <CollectionForm collectionId={id} />;
}