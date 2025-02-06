export const fetch4ByteData = async (selector: string): Promise<any[]> => {
  try {
    const response = await fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`,
    );
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching from 4byte:', error);
    return null;
  }
}; 