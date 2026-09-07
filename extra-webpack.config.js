const CircularDependencyPlugin = require( 'circular-dependency-plugin' );

module.exports = {
	plugins: [
		new CircularDependencyPlugin( {
			exclude: /node_modules/,
			failOnError: false,
			allowAsyncCycles: false,
			cwd: process.cwd(),
		} ),
	],
};
