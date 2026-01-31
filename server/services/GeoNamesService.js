/**
 * GeoNamesService — автоопределение timezone по городу через GeoNames API.
 * Используется при создании/редактировании отеля.
 */

import axios from 'axios'
import { logError, logInfo } from '../utils/logger.js'

const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME
const BASE_URL = 'http://api.geonames.org'

export class GeoNamesService {
  static isConfigured() {
    return Boolean(GEONAMES_USERNAME)
  }

  /**
   * Поиск города → координаты
   */
  static async searchCity(cityName, countryCode = null) {
    if (!GEONAMES_USERNAME) {
      throw new Error('GeoNames API not configured. Set GEONAMES_USERNAME in .env')
    }
    try {
      const params = {
        q: cityName,
        maxRows: 5,
        username: GEONAMES_USERNAME,
        featureClass: 'P',
        orderby: 'population',
        type: 'json'
      }
      if (countryCode) params.country = countryCode

      const response = await axios.get(`${BASE_URL}/searchJSON`, {
        params,
        timeout: 10000
      })

      if (!response.data.geonames || response.data.geonames.length === 0) {
        throw new Error(`City not found: ${cityName}`)
      }

      return response.data.geonames.map((city) => ({
        name: city.name,
        countryName: city.countryName,
        countryCode: city.countryCode,
        lat: parseFloat(city.lat),
        lng: parseFloat(city.lng),
        population: city.population
      }))
    } catch (error) {
      logError('GeoNamesService.searchCity', error)
      throw new Error(
        error.response?.data?.status?.message || error.message || 'Failed to search city'
      )
    }
  }

  /**
   * Координаты → timezone
   */
  static async getTimezoneByCoordinates(lat, lng) {
    if (!GEONAMES_USERNAME) {
      throw new Error('GeoNames API not configured. Set GEONAMES_USERNAME in .env')
    }
    try {
      const response = await axios.get(`${BASE_URL}/timezoneJSON`, {
        params: { lat, lng, username: GEONAMES_USERNAME },
        timeout: 10000
      })

      if (!response.data.timezoneId) {
        throw new Error('Timezone not found for coordinates')
      }

      return {
        timezoneId: response.data.timezoneId,
        countryCode: response.data.countryCode,
        countryName: response.data.countryName,
        rawOffset: response.data.rawOffset,
        dstOffset: response.data.dstOffset
      }
    } catch (error) {
      logError('GeoNamesService.getTimezoneByCoordinates', error)
      throw new Error(
        error.response?.data?.status?.message || error.message || 'Failed to get timezone'
      )
    }
  }

  /**
   * Казахстан: GeoNames возвращает Asia/Almaty (UTC+5); используем Asia/Qostanay (UTC+6).
   */
  static fixKazakhstanTimezone(timezone, countryCode) {
    if (countryCode === 'KZ' && (timezone === 'Asia/Almaty' || timezone === 'Asia/Aqtobe')) {
      return 'Asia/Qostanay'
    }
    return timezone
  }

  /**
   * Город → timezone (поиск города + timezone по координатам)
   */
  static async getTimezoneByCity(cityName, countryCode = null) {
    if (!GEONAMES_USERNAME) {
      throw new Error('GeoNames API not configured. Set GEONAMES_USERNAME in .env')
    }
    try {
      const cities = await this.searchCity(cityName, countryCode)
      if (cities.length === 0) {
        throw new Error(`City not found: ${cityName}`)
      }

      const city = cities[0]
      logInfo('GeoNamesService', `Found city: ${city.name}, ${city.countryName} (${city.lat}, ${city.lng})`)

      const timezone = await this.getTimezoneByCoordinates(city.lat, city.lng)
      const fixedTimezone = this.fixKazakhstanTimezone(timezone.timezoneId, city.countryCode)

      return {
        city: city.name,
        country: city.countryName,
        countryCode: city.countryCode,
        timezone: fixedTimezone,
        coordinates: { lat: city.lat, lng: city.lng }
      }
    } catch (error) {
      logError('GeoNamesService.getTimezoneByCity', error)
      throw error
    }
  }

  /**
   * Подсказки городов для autocomplete
   */
  static async getCitySuggestions(query, limit = 10) {
    if (!GEONAMES_USERNAME) {
      return []
    }
    try {
      const response = await axios.get(`${BASE_URL}/searchJSON`, {
        params: {
          q: query,
          maxRows: limit,
          username: GEONAMES_USERNAME,
          featureClass: 'P',
          orderby: 'population',
          type: 'json'
        },
        timeout: 10000
      })

      const geonames = response.data.geonames || []
      return geonames.map((city) => ({
        name: city.name,
        country: city.countryName,
        countryCode: city.countryCode,
        displayName: `${city.name}, ${city.countryName}`,
        lat: parseFloat(city.lat),
        lng: parseFloat(city.lng)
      }))
    } catch (error) {
      logError('GeoNamesService.getCitySuggestions', error)
      return []
    }
  }
}
