import * as ExifReader from 'exifreader'

type ExifTags = ExifReader.Tags
type DmsRational = [[number, number], [number, number], [number, number]]
type DmsDecimal = [number | null, number | null, number | null]
type GpsTagValue = DmsRational | DmsDecimal | number[] | string | number

export interface PhotoMetadata {
  latitude: number | null
  longitude: number | null
  dateTaken: string | null
}

export async function readExifMetadata(file: File): Promise<PhotoMetadata> {
  try {
    // ExifReader can parse EXIF from HEIC/HEIF, but browser display of those files is separate.
    const tags = await ExifReader.load(file, { async: true })
    const latitude = extractGpsCoordinate(tags, 'GPSLatitude', 'GPSLatitudeRef')
    const longitude = extractGpsCoordinate(tags, 'GPSLongitude', 'GPSLongitudeRef')

    return {
      latitude,
      longitude,
      dateTaken: extractDateTaken(tags),
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to read EXIF metadata.', { cause: error })
  }
}

export function convertGpsCoordinateToDecimal(
  coordinate: GpsTagValue | undefined,
  reference: string | string[] | undefined,
): number | null {
  const decimal = coordinateToDecimal(coordinate)

  if (decimal === null || !reference) {
    return decimal
  }

  const ref = Array.isArray(reference) ? reference.join('') : reference
  const normalizedRef = ref.toUpperCase()

  return normalizedRef === 'S' || normalizedRef === 'W' ? -Math.abs(decimal) : Math.abs(decimal)
}

function extractGpsCoordinate(
  tags: ExifTags,
  coordinateTag: 'GPSLatitude' | 'GPSLongitude',
  referenceTag: 'GPSLatitudeRef' | 'GPSLongitudeRef',
): number | null {
  const coordinate = tags[coordinateTag]?.value as GpsTagValue | undefined
  const reference = tags[referenceTag]?.value as string | string[] | undefined

  return convertGpsCoordinateToDecimal(coordinate, reference)
}

function coordinateToDecimal(coordinate: GpsTagValue | undefined): number | null {
  if (coordinate === undefined || typeof coordinate === 'string') {
    return null
  }

  if (typeof coordinate === 'number') {
    return Number.isFinite(coordinate) ? coordinate : null
  }

  if (isDmsRational(coordinate)) {
    const degrees = rationalToNumber(coordinate[0])
    const minutes = rationalToNumber(coordinate[1])
    const seconds = rationalToNumber(coordinate[2])

    if (degrees === null || minutes === null || seconds === null) {
      return null
    }

    return degrees + minutes / 60 + seconds / 3600
  }

  if (coordinate.length >= 3) {
    const [degrees, minutes, seconds] = coordinate

    if (
      typeof degrees !== 'number' ||
      typeof minutes !== 'number' ||
      typeof seconds !== 'number' ||
      !Number.isFinite(degrees) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(seconds)
    ) {
      return null
    }

    return degrees + minutes / 60 + seconds / 3600
  }

  return null
}

function rationalToNumber(value: [number, number]): number | null {
  const [numerator, denominator] = value

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null
  }

  return numerator / denominator
}

function isDmsRational(value: GpsTagValue): value is DmsRational {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every((part) => Array.isArray(part) && part.length >= 2)
  )
}

function extractDateTaken(tags: ExifTags): string | null {
  const tag =
    tags.DateTimeOriginal ??
    tags.DateTimeDigitized ??
    tags.DateTime ??
    tags['CreateDate'] ??
    tags['ModifyDate']

  if (!tag || typeof tag.value !== 'string') {
    return null
  }

  return tag.value
}
