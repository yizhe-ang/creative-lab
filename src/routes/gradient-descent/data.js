// TODO: Use an tensor library like Tensorflow.js?
// TODO: Generate the data using shaders instead?

export function himmelblausFn(x, y) {
	// https://en.wikipedia.org/wiki/Himmelblau%27s_function
	return (x ** 2 + y - 11) ** 2 + (x + y ** 2 - 7) ** 2;
}

export function genHeightMap(width, depth, fn) {
  return
}