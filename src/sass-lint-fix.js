import Logger from './helpers/logger';
import { resolve } from './helpers/module-resolver';

const gonzales = require('gonzales-pe-sl');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const sassLint = require('sass-lint');
const slConfig = require('sass-lint/lib/config');
const slRules = require('sass-lint/lib/rules');

export default class SlAutoFix {
  constructor (defaultOptions) {
    this._logger = new Logger(defaultOptions.verbose);

    this._defaultOptions = {
      ...defaultOptions
    }
  };

  get logger () {
    return this._logger;
  };

  set logger (logger) {
    this._logger = logger;
  };

  run ({ onResolve }) {
    if (typeof onResolve !== 'function') {
      throw new Error('onResolve must be provided');
    }
    glob(this._defaultOptions.files.include, {}, (_globError, files) => {
      if (_globError) {
        this.logger.verbose('error', _globError);
        return;
      }
      files.forEach(filename => {
        fs.readFile(filename, (_readError, file) => {
          if (_readError) {
            this.logger.verbose('error', _readError);
            return;
          }

          this.logger.verbose('process', filename)

          const ast = gonzales.parse(file.toString(), {
            syntax: path.extname(filename).substr(1)
          });

          const rules = slRules(slConfig())

          return rules
            .filter(rule => !!this._defaultOptions.resolvers[rule.rule.name])
            .map(rule => resolve(`${rule.rule.name}`)
              .then(module => {
                const detects = rule.rule.detect(ast, rule);
                this.logger.verbose(`${filename} - detect`, module.name, '-', detects.length)

                if (detects.length > 0) {
                  const resolver = new module(ast, rule);
                  this.logger.verbose('--fix', `Running [${rule.rule.name}] on ${filename}`)

                  const resolvedTree = resolver.fix();
                  return onResolve.call(this, filename, rule, resolvedTree);
                }
              })
            );
        });
      });
    });
  }
}
