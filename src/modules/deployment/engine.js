const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class DeploymentEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.deployments = new Map();
    this.environments = new Map();
    this.pipelines = new Map();
    this.providers = new Map();
    this.deploymentDir = path.join(os.homedir(), '.pix/deployments');
  }

  async initialize() {
    this.logger.info('Initializing Deployment Engine...');
    await fs.ensureDir(this.deploymentDir);
    await this.loadDeployments();
    this.loadProviders();
    this.loadEnvironments();
    this.logger.info('Deployment Engine initialized');
  }

  async loadDeployments() {
    try {
      const files = await fs.readdir(this.deploymentDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const deployment = await fs.readJson(path.join(this.deploymentDir, file));
          this.deployments.set(deployment.id, deployment);
        }
      }
    } catch (e) {}
  }

  loadProviders() {
    const providers = [
      {
        id: 'vercel',
        name: 'Vercel',
        description: 'Deploy to Vercel',
        commands: {
          deploy: 'vercel --prod',
          preview: 'vercel',
          rollback: 'vercel rollback'
        }
      },
      {
        id: 'netlify',
        name: 'Netlify',
        description: 'Deploy to Netlify',
        commands: {
          deploy: 'netlify deploy --prod',
          preview: 'netlify deploy'
        }
      },
      {
        id: 'heroku',
        name: 'Heroku',
        description: 'Deploy to Heroku',
        commands: {
          deploy: 'git push heroku main',
          rollback: 'heroku rollback'
        }
      },
      {
        id: 'aws',
        name: 'AWS',
        description: 'Deploy to AWS',
        commands: {
          deploy: 'aws s3 sync ./dist s3://bucket-name',
          invalidate: 'aws cloudfront create-invalidation'
        }
      },
      {
        id: 'docker',
        name: 'Docker',
        description: 'Deploy with Docker',
        commands: {
          build: 'docker build -t {{name}} .',
          run: 'docker run -d -p {{port}}:{{port}} {{name}}',
          push: 'docker push {{name}}'
        }
      },
      {
        id: 'railway',
        name: 'Railway',
        description: 'Deploy to Railway',
        commands: {
          deploy: 'railway up',
          logs: 'railway logs'
        }
      },
      {
        id: 'fly',
        name: 'Fly.io',
        description: 'Deploy to Fly.io',
        commands: {
          deploy: 'fly deploy',
          logs: 'fly logs',
          status: 'fly status'
        }
      },
      {
        id: 'digitalocean',
        name: 'DigitalOcean',
        description: 'Deploy to DigitalOcean App Platform',
        commands: {
          deploy: 'doctl apps create --spec spec.yaml'
        }
      }
    ];

    providers.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  loadEnvironments() {
    const defaultEnvs = [
      {
        id: 'development',
        name: 'Development',
        variables: {
          NODE_ENV: 'development',
          DEBUG: 'true'
        },
        isDefault: true
      },
      {
        id: 'staging',
        name: 'Staging',
        variables: {
          NODE_ENV: 'staging',
          DEBUG: 'false'
        }
      },
      {
        id: 'production',
        name: 'Production',
        variables: {
          NODE_ENV: 'production',
          DEBUG: 'false'
        },
        protected: true
      }
    ];

    defaultEnvs.forEach(env => {
      this.environments.set(env.id, env);
    });
  }

  async create(params) {
    const {
      name,
      projectId,
      provider,
      environment = 'development',
      branch = 'main',
      config = {}
    } = params;

    const id = uuidv4();
    const deployment = {
      id,
      name,
      projectId,
      provider,
      environment,
      branch,
      config,
      status: 'pending',
      logs: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
      url: null,
      error: null
    };

    this.deployments.set(id, deployment);
    await this.saveDeployment(deployment);

    this.logger.info(`Deployment created: ${name}`);
    return deployment;
  }

  async deploy(id) {
    const deployment = this.deployments.get(id);
    if (!deployment) throw new Error(`Deployment not found: ${id}`);

    deployment.status = 'deploying';
    deployment.startedAt = new Date().toISOString();
    await this.saveDeployment(deployment);

    const provider = this.providers.get(deployment.provider);
    if (!provider) throw new Error(`Provider not found: ${deployment.provider}`);

    try {
      const env = this.environments.get(deployment.environment);
      const variables = env?.variables || {};

      let command = provider.commands.deploy;
      for (const [key, value] of Object.entries({ ...variables, ...deployment.config })) {
        command = command.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      deployment.logs.push({
        timestamp: new Date().toISOString(),
        message: `Deploying with ${provider.name}...`,
        type: 'info'
      });

      const output = await this.execCommand(command, deployment.config.cwd);

      deployment.logs.push({
        timestamp: new Date().toISOString(),
        message: output,
        type: 'output'
      });

      deployment.status = 'deployed';
      deployment.completedAt = new Date().toISOString();
      deployment.url = this.extractUrl(output);

      await this.saveDeployment(deployment);

      this.logger.info(`Deployment completed: ${deployment.name}`);
      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      deployment.error = error.message;
      deployment.completedAt = new Date().toISOString();

      deployment.logs.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        type: 'error'
      });

      await this.saveDeployment(deployment);

      this.logger.error(`Deployment failed: ${error.message}`);
      throw error;
    }
  }

  async rollback(id) {
    const deployment = this.deployments.get(id);
    if (!deployment) throw new Error(`Deployment not found: ${id}`);

    const provider = this.providers.get(deployment.provider);
    if (!provider?.commands.rollback) {
      throw new Error(`Rollback not supported for ${provider.name}`);
    }

    const command = provider.commands.rollback;
    const output = await this.execCommand(command, deployment.config.cwd);

    deployment.logs.push({
      timestamp: new Date().toISOString(),
      message: `Rolled back: ${output}`,
      type: 'info'
    });

    await this.saveDeployment(deployment);

    return { success: true, output };
  }

  async getLogs(id, options = {}) {
    const { tail = 100, follow = false } = options;
    const deployment = this.deployments.get(id);
    if (!deployment) throw new Error(`Deployment not found: ${id}`);

    return deployment.logs.slice(-tail);
  }

  async getStatus(id) {
    const deployment = this.deployments.get(id);
    if (!deployment) throw new Error(`Deployment not found: ${id}`);

    return {
      id: deployment.id,
      status: deployment.status,
      url: deployment.url,
      environment: deployment.environment,
      provider: deployment.provider,
      createdAt: deployment.createdAt,
      completedAt: deployment.completedAt
    };
  }

  async list(params = {}) {
    const { projectId, status, environment, limit = 50 } = params;

    let deployments = Array.from(this.deployments.values());

    if (projectId) deployments = deployments.filter(d => d.projectId === projectId);
    if (status) deployments = deployments.filter(d => d.status === status);
    if (environment) deployments = deployments.filter(d => d.environment === environment);

    return deployments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  get(id) {
    return this.deployments.get(id);
  }

  async delete(id) {
    this.deployments.delete(id);
    await fs.remove(path.join(this.deploymentDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  getProviders() {
    return Array.from(this.providers.values());
  }

  getEnvironments() {
    return Array.from(this.environments.values());
  }

  async createEnvironment(params) {
    const { id, name, variables = {}, protected: isProtected = false } = params;

    const env = {
      id,
      name,
      variables,
      protected: isProtected,
      createdAt: new Date().toISOString()
    };

    this.environments.set(id, env);
    return env;
  }

  async updateEnvironment(id, updates) {
    const env = this.environments.get(id);
    if (!env) throw new Error(`Environment not found: ${id}`);

    const updated = { ...env, ...updates };
    this.environments.set(id, updated);
    return updated;
  }

  async deleteEnvironment(id) {
    const env = this.environments.get(id);
    if (env?.protected) throw new Error('Cannot delete protected environment');

    this.environments.delete(id);
    return { success: true };
  }

  extractUrl(output) {
    const urlMatch = output.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : null;
  }

  async execCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async saveDeployment(deployment) {
    const filePath = path.join(this.deploymentDir, `${deployment.id}.json`);
    await fs.writeJson(filePath, deployment, { spaces: 2 });
  }

  async getStats() {
    const deployments = Array.from(this.deployments.values());
    return {
      total: deployments.length,
      deployed: deployments.filter(d => d.status === 'deployed').length,
      failed: deployments.filter(d => d.status === 'failed').length,
      pending: deployments.filter(d => d.status === 'pending').length,
      deploying: deployments.filter(d => d.status === 'deploying').length
    };
  }
}

module.exports = DeploymentEngine;
