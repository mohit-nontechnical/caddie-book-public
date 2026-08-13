import { normCourse } from "./course-ratings";

// lat/lng for courses Mo has played (for the map view). Keys are normCourse(name).
const GEO: Record<string, [number, number]> = {
  // 1. Fremont Park Golf Club — Fremont
  "fremont park golf club": [37.5572, -121.9578],
  // 2. Spring Valley Golf Course — Milpitas
  "spring valley golf course": [37.4520, -121.8547],
  // 3. Mission Hills Of Hayward Golf Course — Hayward
  "mission hills of hayward golf course": [37.6256, -122.0442],
  // 4. Dublin Ranch Golf Course — Dublin
  "dublin ranch golf course": [37.7225, -121.8593],
  // 5. Mariners Point Golf Center — Foster City
  "mariners point golf center": [37.5731, -122.2822],
  // 6. Sharp Park Golf Course — Pacifica
  "sharp park golf course": [37.6256, -122.4915],
  // 7. Pleasanton Golf Center — Pleasanton
  "pleasanton golf center": [37.6631, -121.8837],
  // 8. Poplar Creek Golf Course — San Mateo
  "poplar creek golf course": [37.5829, -122.3219],
  // 9. Bayonet & Black Horse — Seaside
  "bayonet and black horse": [36.6322, -121.8203],
  // 10. Deep Cliff Golf Course — Cupertino
  "deep cliff golf course": [37.3095, -122.0629],
  // 11. Monarch Bay Golf Club — San Leandro
  "monarch bay golf club": [37.6961, -122.1861],
  // 12. Shoreline Golf Links — Mountain View
  "shoreline golf links": [37.4312, -122.0815],
  // 13. Baylands Golf Links — Palo Alto
  "baylands golf links": [37.4573, -122.1188],
  // 14. Gleneagles Golf Course — San Francisco (McLaren Park)
  "gleneagles golf course": [37.7159, -122.4249],
  // 15. Simi Hills Golf Course — Simi Valley
  "simi hills golf course": [34.2933, -118.6952],
  // 16. Bay View Golf Club — Milpitas
  "bay view golf club": [37.4554, -121.8815],
  // 17. Sunken Gardens Municipal Golf Course — Sunnyvale
  "sunken gardens municipal golf course": [37.3549, -122.0105],
  // 18. Blackberry Farm Golf club — Cupertino
  "blackberry farm golf club": [37.3199, -122.0605],
  // 19. Blue Rock Springs — Vallejo
  "blue rock springs": [38.1214, -122.1963],
  // 20. Canyon Lakes Golf Club — San Ramon
  "canyon lakes golf club": [37.7647, -121.9440],
  // 21. Crystal Springs Golf Club — Burlingame
  "crystal springs golf club": [37.5573, -122.3830],
  // 22. Las Positas Golf Club — Livermore
  "las positas golf club": [37.6985, -121.8238],
  // 23. Lake Chabot Golf Course — Oakland
  "lake chabot golf course": [37.7419, -122.1220],
  // 24. San Ramon Golf Club — San Ramon
  "san ramon golf club": [37.7344, -121.9291],
  // 25. Lincoln Park Golf Course — San Francisco
  "lincoln park golf course": [37.7839, -122.4963],
  // 26. Peacock Gap Golf Club — San Rafael
  "peacock gap golf club": [37.9944, -122.4647],
  // 27. Golden Gate Park Golf Course — San Francisco
  "golden gate park golf course": [37.7682, -122.5046],
  // 28. Indian Valley Golf Club — Novato
  "indian valley golf club": [38.1095, -122.6373],
  // 29. Silverado Resort and Spa — Napa
  "silverado resort and spa": [38.3504, -122.2598],
  // 30. Napa Golf Course — Napa
  "napa golf course": [38.2658, -122.2763],
  // 31. TPC Harding Park — San Francisco
  "tpc harding park": [37.7247, -122.4937],
};

export function geoFor(name: string): [number, number] | null {
  return GEO[normCourse(name)] ?? null;
}
