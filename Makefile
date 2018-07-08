
assets.js: assets/assets.js assets/*.svg
	assets/makeassets.py $< > $@
