const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class WorkoutEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.workouts = new Map();
    this.exercises = new Map();
    this.routines = new Map();
    this.logs = new Map();
    this.workoutDir = path.join(os.homedir(), '.pix/workouts');
  }

  async initialize() {
    this.logger.info('Initializing Workout Engine...');
    await fs.ensureDir(this.workoutDir);
    await this.loadWorkouts();
    this.loadDefaultExercises();
    this.loadDefaultRoutines();
    this.logger.info('Workout Engine initialized');
  }

  async loadWorkouts() {
    try {
      const files = await fs.readdir(this.workoutDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const workout = await fs.readJson(path.join(this.workoutDir, file));
          this.workouts.set(workout.id, workout);
        }
      }
    } catch (e) {}
  }

  loadDefaultExercises() {
    const exercises = [
      { id: 'pushup', name: 'Push-up', category: 'chest', type: 'bodyweight', muscle: ['chest', 'triceps', 'shoulders'] },
      { id: 'squat', name: 'Squat', category: 'legs', type: 'bodyweight', muscle: ['quadriceps', 'glutes', 'hamstrings'] },
      { id: 'pullup', name: 'Pull-up', category: 'back', type: 'bodyweight', muscle: ['back', 'biceps'] },
      { id: 'plank', name: 'Plank', category: 'core', type: 'bodyweight', muscle: ['core'] },
      { id: 'lunge', name: 'Lunge', category: 'legs', type: 'bodyweight', muscle: ['quadriceps', 'glutes'] },
      { id: 'burpee', name: 'Burpee', category: 'full-body', type: 'bodyweight', muscle: ['full body'] },
      { id: 'jumping-jacks', name: 'Jumping Jacks', category: 'cardio', type: 'bodyweight', muscle: ['full body'] },
      { id: 'mountain-climber', name: 'Mountain Climber', category: 'cardio', type: 'bodyweight', muscle: ['core', 'legs'] },
      { id: 'deadlift', name: 'Deadlift', category: 'back', type: 'weighted', muscle: ['back', 'hamstrings', 'glutes'] },
      { id: 'bench-press', name: 'Bench Press', category: 'chest', type: 'weighted', muscle: ['chest', 'triceps', 'shoulders'] },
      { id: 'overhead-press', name: 'Overhead Press', category: 'shoulders', type: 'weighted', muscle: ['shoulders', 'triceps'] },
      { id: 'barbell-row', name: 'Barbell Row', category: 'back', type: 'weighted', muscle: ['back', 'biceps'] },
      { id: 'bicep-curl', name: 'Bicep Curl', category: 'arms', type: 'weighted', muscle: ['biceps'] },
      { id: 'tricep-dip', name: 'Tricep Dip', category: 'arms', type: 'bodyweight', muscle: ['triceps'] },
      { id: 'calf-raise', name: 'Calf Raise', category: 'legs', type: 'bodyweight', muscle: ['calves'] },
      { id: 'russian-twist', name: 'Russian Twist', category: 'core', type: 'bodyweight', muscle: ['obliques'] },
      { id: 'leg-raise', name: 'Leg Raise', category: 'core', type: 'bodyweight', muscle: ['lower abs'] },
      { id: 'crunch', name: 'Crunch', category: 'core', type: 'bodyweight', muscle: ['abs'] },
      { id: 'running', name: 'Running', category: 'cardio', type: 'cardio', muscle: ['legs', 'cardiovascular'] },
      { id: 'cycling', name: 'Cycling', category: 'cardio', type: 'cardio', muscle: ['legs', 'cardiovascular'] }
    ];

    exercises.forEach(ex => {
      this.exercises.set(ex.id, ex);
    });
  }

  loadDefaultRoutines() {
    const routines = [
      {
        id: 'full-body',
        name: 'Full Body Workout',
        description: 'Complete full body workout',
        exercises: [
          { exerciseId: 'pushup', sets: 3, reps: 15, rest: 60 },
          { exerciseId: 'squat', sets: 3, reps: 20, rest: 60 },
          { exerciseId: 'pullup', sets: 3, reps: 10, rest: 90 },
          { exerciseId: 'plank', sets: 3, duration: 60, rest: 45 },
          { exerciseId: 'burpee', sets: 3, reps: 10, rest: 60 }
        ],
        duration: 45,
        difficulty: 'intermediate'
      },
      {
        id: 'upper-body',
        name: 'Upper Body Focus',
        description: 'Upper body strength workout',
        exercises: [
          { exerciseId: 'bench-press', sets: 4, reps: 10, rest: 90 },
          { exerciseId: 'barbell-row', sets: 4, reps: 10, rest: 90 },
          { exerciseId: 'overhead-press', sets: 3, reps: 12, rest: 60 },
          { exerciseId: 'bicep-curl', sets: 3, reps: 12, rest: 45 },
          { exerciseId: 'tricep-dip', sets: 3, reps: 15, rest: 45 }
        ],
        duration: 50,
        difficulty: 'intermediate'
      },
      {
        id: 'lower-body',
        name: 'Lower Body Focus',
        description: 'Lower body strength workout',
        exercises: [
          { exerciseId: 'squat', sets: 4, reps: 12, rest: 90 },
          { exerciseId: 'lunge', sets: 3, reps: 12, rest: 60 },
          { exerciseId: 'deadlift', sets: 4, reps: 10, rest: 120 },
          { exerciseId: 'calf-raise', sets: 3, reps: 20, rest: 45 },
          { exerciseId: 'plank', sets: 3, duration: 60, rest: 45 }
        ],
        duration: 55,
        difficulty: 'intermediate'
      },
      {
        id: 'core-blast',
        name: 'Core Blast',
        description: 'Intense core workout',
        exercises: [
          { exerciseId: 'plank', sets: 3, duration: 60, rest: 30 },
          { exerciseId: 'crunch', sets: 3, reps: 20, rest: 30 },
          { exerciseId: 'russian-twist', sets: 3, reps: 20, rest: 30 },
          { exerciseId: 'leg-raise', sets: 3, reps: 15, rest: 30 },
          { exerciseId: 'mountain-climber', sets: 3, duration: 30, rest: 30 }
        ],
        duration: 30,
        difficulty: 'beginner'
      },
      {
        id: 'hiit',
        name: 'HIIT Cardio',
        description: 'High intensity interval training',
        exercises: [
          { exerciseId: 'burpee', sets: 4, duration: 30, rest: 30 },
          { exerciseId: 'jumping-jacks', sets: 4, duration: 30, rest: 30 },
          { exerciseId: 'mountain-climber', sets: 4, duration: 30, rest: 30 },
          { exerciseId: 'squat', sets: 4, duration: 30, rest: 30 }
        ],
        duration: 25,
        difficulty: 'advanced'
      }
    ];

    routines.forEach(routine => {
      this.routines.set(routine.id, routine);
    });
  }

  async createWorkout(params) {
    const {
      name,
      routineId = null,
      exercises = [],
      notes = '',
      duration = 0,
      caloriesBurned = 0,
      date = new Date().toISOString()
    } = params;

    const id = uuidv4();
    const workout = {
      id,
      name,
      routineId,
      exercises: exercises.length > 0 ? exercises : (routineId ? this.routines.get(routineId)?.exercises || [] : []),
      notes,
      duration,
      caloriesBurned,
      date: new Date(date).toISOString(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.workouts.set(id, workout);
    await this.saveWorkout(workout);

    this.logger.info(`Workout created: ${name}`);
    return workout;
  }

  async completeWorkout(id, data = {}) {
    const workout = this.workouts.get(id);
    if (!workout) throw new Error(`Workout not found: ${id}`);

    workout.completed = true;
    workout.completedAt = new Date().toISOString();
    workout.duration = data.duration || workout.duration;
    workout.caloriesBurned = data.caloriesBurned || workout.caloriesBurned;
    workout.notes = data.notes || workout.notes;

    this.workouts.set(id, workout);
    await this.saveWorkout(workout);

    return workout;
  }

  async deleteWorkout(id) {
    this.workouts.delete(id);
    await fs.remove(path.join(this.workoutDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getWorkout(id) {
    return this.workouts.get(id);
  }

  listWorkouts(options = {}) {
    const { startDate, endDate, completed, limit = 50 } = options;

    let workouts = Array.from(this.workouts.values());

    if (startDate) workouts = workouts.filter(w => new Date(w.date) >= new Date(startDate));
    if (endDate) workouts = workouts.filter(w => new Date(w.date) <= new Date(endDate));
    if (completed !== undefined) workouts = workouts.filter(w => w.completed === completed);

    workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

    return workouts.slice(0, limit);
  }

  getExercises() {
    return Array.from(this.exercises.values());
  }

  getExercise(id) {
    return this.exercises.get(id);
  }

  getRoutines() {
    return Array.from(this.routines.values());
  }

  getRoutine(id) {
    return this.routines.get(id);
  }

  async getWeeklyStats() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const workouts = this.listWorkouts({
      startDate: weekStart.toISOString(),
      completed: true
    });

    const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);

    return {
      workouts: workouts.length,
      totalDuration,
      totalCalories,
      averageDuration: workouts.length > 0 ? Math.round(totalDuration / workouts.length) : 0
    };
  }

  async getMonthlyStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const workouts = this.listWorkouts({
      startDate: monthStart.toISOString(),
      completed: true
    });

    return {
      workouts: workouts.length,
      totalDuration: workouts.reduce((sum, w) => sum + w.duration, 0),
      totalCalories: workouts.reduce((sum, w) => sum + w.caloriesBurned, 0)
    };
  }

  async getStats() {
    const workouts = Array.from(this.workouts.values());
    const completed = workouts.filter(w => w.completed);

    return {
      totalWorkouts: workouts.length,
      completedWorkouts: completed.length,
      totalDuration: completed.reduce((sum, w) => sum + w.duration, 0),
      totalCalories: completed.reduce((sum, w) => sum + w.caloriesBurned, 0),
      exercises: this.exercises.size,
      routines: this.routines.size
    };
  }

  async saveWorkout(workout) {
    const filePath = path.join(this.workoutDir, `${workout.id}.json`);
    await fs.writeJson(filePath, workout, { spaces: 2 });
  }

  async exportWorkouts(format = 'json') {
    const workouts = Array.from(this.workouts.values());

    if (format === 'json') {
      return JSON.stringify(workouts, null, 2);
    }

    return workouts;
  }
}

module.exports = WorkoutEngine;
