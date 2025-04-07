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

/**
 * Searches for board games by name on BoardGameGeek.
 * @param query - The search term for the board game.
 * @returns An array of search results with game IDs, names, and optional years.
 */
export const searchBGGGames = async (
  query: string
): Promise<{ id: string; name: string; year?: number }[]> => {
  try {
    const response = await axios.get(`${BGG_API_BASE_URL}/search`, {
      params: { query, type: 'boardgame' },
    });

    // Parse the XML response to extract search results
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');
    const items = Array.from(xmlDoc.getElementsByTagName('item'));

    return items.map((item) => {
      const id = item.getAttribute('id')!;
      const name = item.getElementsByTagName('name')[0]?.getAttribute('value') || '';
      const year = item.getElementsByTagName('yearpublished')[0]?.getAttribute('value');
      return { id, name, year: year ? parseInt(year, 10) : undefined };
    });
  } catch (error) {
    console.error('Error searching BoardGameGeek:', error);
    throw error;
  }
};

/**
 * Fetches detailed information about a board game by its ID.
 * @param gameId - The ID of the board game.
 * @returns An object containing the game's details.
 */
export const fetchBGGGameDetails = async (gameId: string): Promise<{
  title: string;
  image: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  weight: number;
  rank: number;
  description: string;
}> => {
  try {
    const response = await axios.get(`${BGG_API_BASE_URL}/thing`, {
      params: { id: gameId },
    });

    // Parse the XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');

    const title = xmlDoc.getElementsByTagName('name')[0]?.getAttribute('value') || '';
    const image = xmlDoc.getElementsByTagName('image')[0]?.textContent || '';
    const minPlayers = parseInt(xmlDoc.getElementsByTagName('minplayers')[0]?.getAttribute('value') || '0', 10);
    const maxPlayers = parseInt(xmlDoc.getElementsByTagName('maxplayers')[0]?.getAttribute('value') || '0', 10);
    const playingTime = parseInt(xmlDoc.getElementsByTagName('playingtime')[0]?.getAttribute('value') || '0', 10);
    const weight = parseFloat(
      xmlDoc.querySelector('statistics > ratings > averageweight')?.textContent || '0'
    );
    const rank = parseInt(
      xmlDoc.querySelector('statistics > ratings > ranks > rank[type="subtype"]')?.getAttribute('value') || '0',
      10
    );
    const description = xmlDoc.getElementsByTagName('description')[0]?.textContent || '';

    return {
      title,
      image,
      minPlayers,
      maxPlayers,
      playingTime,
      weight,
      rank,
      description,
    };
  } catch (error) {
    console.error('Error fetching BGG game details:', error);
    throw error;
  }
};