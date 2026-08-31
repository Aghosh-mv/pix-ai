const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class RecipeEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.recipes = new Map();
    this.cookbooks = new Map();
    this.mealPlan = new Map();
    this.shoppingList = new Map();
    this.recipeDir = path.join(os.homedir(), '.pix/recipes');
  }

  async initialize() {
    this.logger.info('Initializing Recipe Engine...');
    await fs.ensureDir(this.recipeDir);
    await this.loadRecipes();
    this.loadDefaultCategories();
    this.logger.info('Recipe Engine initialized');
  }

  async loadRecipes() {
    try {
      const files = await fs.readdir(this.recipeDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const recipe = await fs.readJson(path.join(this.recipeDir, file));
          this.recipes.set(recipe.id, recipe);
        }
      }
    } catch (e) {}
  }

  loadDefaultCategories() {
    this.categories = [
      { id: 'breakfast', name: 'Breakfast', icon: '🥞' },
      { id: 'lunch', name: 'Lunch', icon: '🥗' },
      { id: 'dinner', name: 'Dinner', icon: '🍽️' },
      { id: 'snack', name: 'Snack', icon: '🍿' },
      { id: 'dessert', name: 'Dessert', icon: '🍰' },
      { id: 'vegetarian', name: 'Vegetarian', icon: '🥬' },
      { id: 'vegan', name: 'Vegan', icon: '🌱' },
      { id: 'gluten-free', name: 'Gluten Free', icon: '🌾' }
    ];
  }

  async createRecipe(params) {
    const {
      name,
      description = '',
      category = 'dinner',
      ingredients = [],
      instructions = [],
      prepTime = 0,
      cookTime = 0,
      servings = 4,
      difficulty = 'medium',
      tags = [],
      notes = '',
      nutrition = {}
    } = params;

    const id = uuidv4();
    const recipe = {
      id,
      name,
      description,
      category,
      ingredients,
      instructions,
      prepTime,
      cookTime,
      totalTime: prepTime + cookTime,
      servings,
      difficulty,
      tags,
      notes,
      nutrition,
      rating: 0,
      timesCooked: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.recipes.set(id, recipe);
    await this.saveRecipe(recipe);

    this.logger.info(`Recipe created: ${name}`);
    return recipe;
  }

  async updateRecipe(id, updates) {
    const recipe = this.recipes.get(id);
    if (!recipe) throw new Error(`Recipe not found: ${id}`);

    const updated = {
      ...recipe,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.prepTime || updates.cookTime) {
      updated.totalTime = (updated.prepTime || recipe.prepTime) + (updated.cookTime || recipe.cookTime);
    }

    this.recipes.set(id, updated);
    await this.saveRecipe(updated);

    return updated;
  }

  async deleteRecipe(id) {
    this.recipes.delete(id);
    await fs.remove(path.join(this.recipeDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getRecipe(id) {
    return this.recipes.get(id);
  }

  listRecipes(options = {}) {
    const { category, difficulty, tags, search, limit = 50 } = options;

    let recipes = Array.from(this.recipes.values());

    if (category) recipes = recipes.filter(r => r.category === category);
    if (difficulty) recipes = recipes.filter(r => r.difficulty === difficulty);
    if (tags && tags.length > 0) recipes = recipes.filter(r => tags.some(t => r.tags.includes(t)));
    if (search) {
      const searchLower = search.toLowerCase();
      recipes = recipes.filter(r =>
        r.name.toLowerCase().includes(searchLower) ||
        r.description.toLowerCase().includes(searchLower) ||
        r.ingredients.some(i => i.name.toLowerCase().includes(searchLower))
      );
    }

    return recipes.slice(0, limit);
  }

  async cookRecipe(id) {
    const recipe = this.recipes.get(id);
    if (!recipe) throw new Error(`Recipe not found: ${id}`);

    recipe.timesCooked++;
    recipe.updatedAt = new Date().toISOString();
    this.recipes.set(id, recipe);
    await this.saveRecipe(recipe);

    return recipe;
  }

  async rateRecipe(id, rating) {
    const recipe = this.recipes.get(id);
    if (!recipe) throw new Error(`Recipe not found: ${id}`);

    recipe.rating = Math.max(0, Math.min(5, rating));
    recipe.updatedAt = new Date().toISOString();
    this.recipes.set(id, recipe);
    await this.saveRecipe(recipe);

    return recipe;
  }

  async addToMealPlan(params) {
    const { recipeId, date, meal } = params;
    const dateStr = new Date(date).toISOString().split('T')[0];

    if (!this.mealPlan.has(dateStr)) {
      this.mealPlan.set(dateStr, {});
    }

    this.mealPlan.get(dateStr)[meal] = recipeId;
    return { date: dateStr, meal, recipeId };
  }

  async getMealPlan(date) {
    const dateStr = new Date(date).toISOString().split('T')[0];
    return this.mealPlan.get(dateStr) || {};
  }

  async generateShoppingList(recipeIds) {
    const ingredients = new Map();

    for (const recipeId of recipeIds) {
      const recipe = this.recipes.get(recipeId);
      if (!recipe) continue;

      for (const ingredient of recipe.ingredients) {
        const key = `${ingredient.name}-${ingredient.unit}`;
        if (ingredients.has(key)) {
          const existing = ingredients.get(key);
          existing.quantity += ingredient.quantity;
        } else {
          ingredients.set(key, { ...ingredient });
        }
      }
    }

    return Array.from(ingredients.values());
  }

  async createCookbook(params) {
    const { name, description = '', recipeIds = [] } = params;
    const id = uuidv4();

    const cookbook = {
      id,
      name,
      description,
      recipeIds,
      createdAt: new Date().toISOString()
    };

    this.cookbooks.set(id, cookbook);
    return cookbook;
  }

  async getCookbook(id) {
    return this.cookbooks.get(id);
  }

  listCookbooks() {
    return Array.from(this.cookbooks.values());
  }

  async addRecipeToCookbook(cookbookId, recipeId) {
    const cookbook = this.cookbooks.get(cookbookId);
    if (!cookbook) throw new Error(`Cookbook not found: ${cookbookId}`);

    if (!cookbook.recipeIds.includes(recipeId)) {
      cookbook.recipeIds.push(recipeId);
    }

    return cookbook;
  }

  getCategories() {
    return this.categories;
  }

  async searchRecipes(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, recipe] of this.recipes) {
      let score = 0;

      if (recipe.name.toLowerCase().includes(queryLower)) score += 10;
      if (recipe.description.toLowerCase().includes(queryLower)) score += 5;
      if (recipe.ingredients.some(i => i.name.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...recipe, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const recipes = Array.from(this.recipes.values());

    return {
      totalRecipes: recipes.length,
      categories: this.categories.length,
      cookbooks: this.cookbooks.size,
      mostCooked: recipes.sort((a, b) => b.timesCooked - a.timesCooked).slice(0, 5),
      topRated: recipes.sort((a, b) => b.rating - a.rating).slice(0, 5)
    };
  }

  async saveRecipe(recipe) {
    const filePath = path.join(this.recipeDir, `${recipe.id}.json`);
    await fs.writeJson(filePath, recipe, { spaces: 2 });
  }

  async exportRecipes(format = 'json') {
    const recipes = Array.from(this.recipes.values());

    if (format === 'json') {
      return JSON.stringify(recipes, null, 2);
    }

    if (format === 'markdown') {
      return recipes.map(r => {
        let md = `# ${r.name}\n\n`;
        md += `${r.description}\n\n`;
        md += `**Prep Time:** ${r.prepTime} min | **Cook Time:** ${r.cookTime} min | **Servings:** ${r.servings}\n\n`;
        md += `## Ingredients\n\n`;
        r.ingredients.forEach(i => {
          md += `- ${i.quantity} ${i.unit} ${i.name}\n`;
        });
        md += `\n## Instructions\n\n`;
        r.instructions.forEach((inst, i) => {
          md += `${i + 1}. ${inst}\n`;
        });
        return md;
      }).join('\n\n---\n\n');
    }

    return recipes;
  }
}

module.exports = RecipeEngine;
