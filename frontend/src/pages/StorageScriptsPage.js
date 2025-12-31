import StorageScriptsContent from "../components/storage/StorageScriptsContent";

/**
 * StorageScriptsPage - Shows storage scripts for ALL storage systems in the project
 * This is the main /scripts/storage page
 */
const StorageScriptsPage = () => {
  return (
    <StorageScriptsContent
      backPath="/storage/systems"
    />
  );
};

export default StorageScriptsPage;
