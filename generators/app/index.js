const Generator = require('yeoman-generator');
const util = require('util');
const beautify = require('gulp-beautify');
const filter = require('gulp-filter');
const fs = require('mz/fs');
const startCase = require('lodash/startCase');

const defaults = {
  type: 'React',
  eslint: true,
  styleGuide: 'AirBnB',
  flow: true,
  jsxExtension: '.js',
  specFileNames: '[filename].spec[extension]',
};

const styleGuideDefaults = {
  AirBnB: {
    jsxExtension: '.jsx',
  },
};


const inspect = (that, what) => that.log(util.inspect(what, { colors: true }));

function installDependencyIf(that, condition, dependency, dev) {
  if (condition) {
    const options = {};

    if (dev) {
      options.dev = true;
    }

    that.yarnInstall(dependency, options);
  }
}

function installDevDependencyIf(that, condition, dependency) {
  return installDependencyIf(that, condition, dependency, true);
}

const formatTemplateName = name => name.replace(/[^A-Z0-9]/gi, '');

module.exports = class extends Generator {
  constructor(...params) {
    super(...params);

    this.dependencies = new Set();
    this.devDependencies = new Set();

    this.argument('destination', { type: String, required: false });

    this.option('use-defaults', {
      desc: 'Use default values for all question and don\'t prompt them',
      alias: 'y',
      default: false,
      type: Boolean,
    });

    const destination = this.options.destination;
    const beautifyFilter = filter(['**/*.js', '**/*.jsx'], { restore: true });
    const beautifyOptions = { indent_size: 2 };

    this.registerTransformStream([
      beautifyFilter,
      beautify(beautifyOptions),
      beautifyFilter.restore,
    ]);

    if (destination) {
      const newDestinationPath = this.destinationPath(destination);

      this.destinationRoot(newDestinationPath);
    }
  }

  parseTemplateDependencies() {
    const typeFromConfig = this.config.get('type');
    const type = formatTemplateName(typeFromConfig);
    const templateConfigFileName = 'template.json';
    const fullTemplatePath = this.templatePath(type, templateConfigFileName);

    if (this.fs.exists(fullTemplatePath)) {
      const { dependencies, devDependencies } = this.fs.readJSON(fullTemplatePath);

      dependencies.forEach(dependency => this.dependencies.add(dependency));
      devDependencies.forEach(devDependency => this.devDependencies.add(devDependency));
    }
  }

  installDependencies() {
    this.yarnInstall([...this.dependencies]);
    this.yarnInstall([...this.devDependencies], { dev: true });
  }

  async prompting() {
    const templateDirs = await fs.readdir(this.templatePath());
    const templates = templateDirs.map(dir => startCase(dir).replace(/\s+/gi, ' + '));

    const skipPrompts = this.options['use-defaults'];

    let answers = {};

    if (!skipPrompts) {
      answers = await this.prompt([{
        type    : 'list',
        name    : 'type',
        message : 'What type of project do you want to generate?',
        default : defaults.type,
        choices : templates,
      }, {
        type    : 'confirm',
        name    : 'eslint',
        message : 'Would you like to enable and configure eslint?',
        default : defaults.eslint,
      }, {
        type    : 'list',
        name    : 'styleGuide',
        message : 'Would you like to use one of existing eslint style guides?',
        default : defaults.styleGuide,
        choices : [
          'AirBnB',
        ],
        when: answers => answers.eslint,
      }, {
        type    : 'confirm',
        name    : 'flow',
        message : 'Would you like to use Flow for static typing?',
        default : defaults.flow,
      }]);
    }

    const userConfig = Object.assign({}, defaults, answers);

    installDevDependencyIf(this, userConfig.eslint, 'eslint');

    this.config.set(userConfig);
    this.config.save();
  }

  writing() {
    const typeFromConfig = this.config.get('type');
    const type = formatTemplateName(typeFromConfig);

    this.templatePath(type);

    this.fs.copyTpl(
      this.templatePath(`${type}/files`),
      this.destinationPath('.'), {
        title: 'Templating with Yeoman',
        sth: true,
      }
    );
  }
};

// eslint