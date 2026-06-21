# Photo Mapper

Photo Mapper is a simple browser-based tool for mapping field photos that contain GPS metadata.

Upload photos from your computer, and the app reads the embedded EXIF GPS information, places the photos on a map, and lets you review each image with its mapped location.

## What it does

* Imports local photo files from your computer
* Reads EXIF GPS metadata from supported image files
* Maps photos with valid coordinates
* Separates photos with missing GPS or metadata errors
* Shows photo previews linked to map locations
* Supports enlarged photo viewing with previous/next navigation
* Keeps the map focused on the last photo viewed
* Exports mapped photo information to CSV

## Why it is useful

Photo Mapper is intended for field visits, site reviews, inspections, and quick visual documentation where photos need to be tied back to their locations.

It is especially useful when reviewing a batch of field photos and answering basic questions such as:

* Where was this photo taken?
* Which photos have valid GPS metadata?
* Which photos are missing location data?
* Can I quickly export the mapped photo list?

## Local-first design

Photo Mapper is designed around local photo import. Photos are selected from the user’s computer and processed in the browser.

The app does not require cloud import, cloud storage, or a project account.

## Supported photo types

The app supports common image formats, including:

* JPG / JPEG
* PNG
* HEIC / HEIF, depending on browser support

GPS mapping depends on whether the photo file contains usable EXIF GPS metadata.

## Running locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Tech stack

* React
* TypeScript
* Vite
* Leaflet / React Leaflet
* EXIF metadata parsing

## Current focus

The app is intentionally lightweight and focused on local field-photo mapping. Future enhancements may include drag-and-drop upload, folder upload, status filters, KML/GeoJSON export, photo notes, and manual location assignment for photos without GPS.
