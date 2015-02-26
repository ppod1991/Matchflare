//Gulp tasks

var gulp = require('gulp');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var imagemin = require('gulp-imagemin');
var htmlmin = require('gulp-htmlmin');
var jade = require('gulp-jade');
var nodemon = require('gulp-nodemon');
var autoprefixer = require('gulp-autoprefixer'),
    minifycss = require('gulp-minify-css'),
    clean = require('gulp-clean'),
    notify = require('gulp-notify'),
    cache = require('gulp-cache');

var paths = {scripts: ['client/js/**/*.js','client/js/*.js'],
			 images: ['client/img/*'],
			 html: ['client/views/**/*.html','client/views/*.html','client/*.html'],
			 css: ['client/css/*.css'],
			 jade: ['client/views/**/*.jade','client/views/*.jade','client/index.jade'],
			 compile: ['client/resources/.js','./server.js','client/build/**']};

gulp.task('lint', function () {
	return gulp.src('scripts.paths')
			.pipe(jshint())
			.pipe(jshint.reporter('default'));
});

gulp.task('scripts',function() {
	return gulp.src(paths.scripts)
			.pipe(concat('all.js'))
			.pipe(rename('all.min.js'))
			.pipe(gulp.dest('client/build/js'));
});

gulp.task('styles', function() {
  return gulp.src(paths.css)
    .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
    .pipe(gulp.dest('client/build/css'))
    .pipe(rename({suffix: '.min'}))
    .pipe(minifycss())
    .pipe(gulp.dest('client/build/css'));
});

// Copy all static images
gulp.task('images', function() {
  return gulp.src(paths.images)
    // Pass in options to the task
    .pipe(cache(imagemin({optimizationLevel: 5, progressive: true, interlaced: true })))
    .pipe(gulp.dest('client/build/img'));
});

gulp.task('htmlmin', function() {
  gulp.src(paths.jade)
  	.pipe(jade({}))
  	.pipe(htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest('client/build/html'));
});

gulp.task('clean', function() {
  return gulp.src(['client/build/js','client/build/html','client/build/css','client/build/img'], {read: false})
    .pipe(clean());
});

gulp.task('watch',function() {
	gulp.watch(paths.scripts,['lint','scripts']);
	gulp.watch(paths.jade,['htmlmin']);
	gulp.watch(paths.css,['styles']);
	gulp.watch(paths.images,['images']);
});

//run app using nodemon
gulp.task('serve',['default'], function(){
  return nodemon({script: 'server.js'})
			.on('restart',function () {
				console.log("Restarted");
			});
});

gulp.task('default',['clean'], function() {
	gulp.start(['styles','lint','scripts','watch','images','htmlmin']);
});
