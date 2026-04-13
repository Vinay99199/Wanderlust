mapboxgl.accessToken = mapToken;

const map = new mapboxgl.Map({
        container: "map", // container ID
        style: 'mapbox://styles/mapbox/streets-v12', // Use the standard style for the map
        center: listing.geocoding.coordinates, // starting position [lng, lat]
        zoom: 10, // initial zoom level, 0 is the world view, higher values zoom in
    });


const marker = new mapboxgl.Marker({ color: 'red' }) // create a new marker with a red color
.setLngLat(listing.geocoding.coordinates) // set the marker's position to the same coordinates as the map's center
.setPopup(
    new mapboxgl.Popup({ offset: 25 })
    .setHTML(`<h4>${listing.title}</h4><p>Exact Location will be provided after booking</p>`) // set the HTML content of the popup to display the listing's title and location
) 
.addTo(map); // add the marker to the map