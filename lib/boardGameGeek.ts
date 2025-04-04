import axios from 'axios';

const BGG_API_BASE_URL = 'https://boardgamegeek.com/xmlapi2';

/**
 * Fetches the title of a board game by its ID.
 * @param gameId - The ID of the board game.
 * @returns The title of the board game.
 */
export const fetchBGGTitle = async (gameId: string): Promise<string> => {
  try {
    const response = await axios.get(`${BGG_API_BASE_URL}/thing`, {
      params: { id: gameId },
    });

    // Parse the XML response to extract the title
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');
    const title = xmlDoc.getElementsByTagName('name')[0]?.getAttribute('value');

    if (!title) {
      throw new Error('Title not found in the response.');
    }

    return title;
  } catch (error) {
    console.error('Error fetching BGG title:', error);
    throw error;
  }
};

/**
 * Fetches the image URL of a board game by its ID.
 * @param gameId - The ID of the board game.
 * @returns The image URL of the board game.
 */
export const fetchBGGImage = async (gameId: string): Promise<string> => {
  try {
    const response = await axios.get(`${BGG_API_BASE_URL}/thing`, {
      params: { id: gameId },
    });

    // Parse the XML response to extract the image URL
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');
    const imageUrl = xmlDoc.getElementsByTagName('image')[0]?.textContent;

    if (!imageUrl) {
      throw new Error('Image URL not found in the response.');
    }

    return imageUrl;
  } catch (error) {
    console.error('Error fetching BGG image:', error);
    throw error;
  }
};