import axios from "axios";

const usePaginatedFetch = () => {
  const fetchAllPages = async (initialUrl, token) => {
    let url = initialUrl;
    let allData = [];

    try {
      while (url) {
        const response = await axios.get(url, {
          headers: {
            "x-api-token": token
          }
        });

        const pageData = response.data?.data || [];
        allData = allData.concat(pageData);

        const nextLink = response.data.links?.find(link => link.params?.rel === "next");
        url = nextLink ? nextLink.uri : null;
      }
    } catch (error) {
      console.error("Pagination fetch failed:", error);
      throw error;
    }

    return allData;
  };

  return { fetchAllPages };
};

export default usePaginatedFetch;