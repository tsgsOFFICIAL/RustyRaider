const { createApp, reactive } = Vue;

createApp({
	data: function () {
		return {
			showWeaponsModal: false,
			structuresExpanded: false,
			selectedStructures: [],
			weapons: [],
			structures: [],
			instanceCounter: 0
		};
	},
	computed: {
		totalRequirements: function () {
			var requirements = {};
			var self = this;

			if (!this.selectedStructures || !this.selectedStructures.length) {
				return [];
			}

			this.selectedStructures.forEach(function (structure) {
				var structureReqs = self.getAvailableWeaponsRequirements(structure);
				if (structureReqs && structureReqs.length) {
					structureReqs.forEach(function (req) {
						if (req && req.weapon && typeof req.quantity === "number") {
							if (!requirements[req.weapon]) {
								requirements[req.weapon] = 0;
							}
							requirements[req.weapon] += req.quantity;
						}
					});
				}
			});

			var result = Object.entries(requirements).map(function (entry) {
				return { weapon: entry[0], quantity: entry[1] };
			});

			console.log("totalRequirements computed:", result);
			return result;
		},
		totalTime: function () {
			var self = this;
			var total = this.selectedStructures.reduce(function (total, structure) {
				return total + self.getAvailableWeaponsTime(structure);
			}, 0);
			console.log("totalTime computed:", total);
			return total;
		},
		totalSulfur: function () {
			var self = this;
			var total = this.selectedStructures.reduce(function (total, structure) {
				return total + self.getAvailableWeaponsSulfur(structure);
			}, 0);
			console.log("totalSulfur computed:", total);
			return total;
		},
		totalStructureCount: function () {
			var total = this.selectedStructures.reduce(function (total, structure) {
				return total + structure.quantity;
			}, 0);
			console.log("totalStructureCount computed:", total);
			return total;
		}
	},
	mounted: function () {
		this.fetchData();
	},
	methods: {
		fetchData: function () {
			var self = this;
			Promise.all([
				fetch("data/weapons.json").then(function (response) {
					return response.json();
				}),
				fetch("data/structures.json").then(function (response) {
					return response.json();
				})
			])
				.then(function (responses) {
					var savedWeapons = localStorage.getItem("rustyraider_weapons");
					var savedData = savedWeapons ? JSON.parse(savedWeapons) : {};
					self.weapons = responses[0].map(function (weapon) {
						var saved = savedData[weapon.id] || { enabled: false, quantity: 0 };
						return Object.assign({}, weapon, {
							enabled: saved.enabled || false,
							quantity: saved.quantity || 0,
							attackTime: weapon["attackTime"] || 5
						});
					});
					self.structures = responses[1];
					console.log("Weapons loaded:", self.weapons);
					console.log("Structures loaded:", self.structures);
				})
				.catch(function (error) {
					console.error("Error loading data files:", error);
				});
		},
		saveWeaponsToLocalStorage: function () {
			var weaponData = {};
			this.weapons.forEach(function (weapon) {
				weaponData[weapon.id] = {
					enabled: weapon.enabled,
					quantity: weapon.quantity
				};
			});
			localStorage.setItem("rustyraider_weapons", JSON.stringify(weaponData));
			console.log("Weapons saved to localStorage:", weaponData);
		},
		getWeaponName: function (weaponId) {
			var weapon = this.weapons.find(function (w) {
				return w.id === weaponId;
			});
			return weapon ? weapon.name : weaponId;
		},
		openWeaponsModal: function () {
			this.showWeaponsModal = true;
		},
		closeWeaponsModal: function () {
			this.showWeaponsModal = false;
		},
		toggleStructures: function () {
			this.structuresExpanded = !this.structuresExpanded;
		},
		toggleWeapon: function (weaponId) {
			var weapon = this.weapons.find(function (w) {
				return w.id === weaponId;
			});
			if (weapon) {
				weapon.enabled = !weapon.enabled;
				if (weapon.quantity > 0) {
					weapon.quantity = 0; // Reset quantity if toggling enabled
				}
				this.saveWeaponsToLocalStorage();
				console.log("Toggled weapon:", weapon.id, "enabled:", weapon.enabled);
			}
		},
		updateWeaponQuantity: function (weaponId, value) {
			var weapon = this.weapons.find(function (w) {
				return w.id === weaponId;
			});
			if (weapon) {
				weapon.quantity = parseInt(value) || 0;

				if (weapon.quantity > 0) {
					weapon.enabled = false; // Disable weapon if quantity is set
				}

				this.saveWeaponsToLocalStorage();
				console.log("Updated weapon quantity:", weapon.id, "quantity:", weapon.quantity);
			}
		},
		addStructure: function (structure) {
			var existingStructure = this.selectedStructures.find(function (s) {
				return s.id === structure.id;
			});
			if (existingStructure) {
				existingStructure.quantity += 1;
				console.log("Incremented structure:", structure.id, "quantity:", existingStructure.quantity);
			} else {
				var reactiveStructure = reactive(
					Object.assign({}, structure, {
						useSoftside: false,
						quantity: 1,
						instanceId: this.instanceCounter++
					})
				);
				this.selectedStructures.push(reactiveStructure);
				console.log("Added new structure:", structure.id, "instanceId:", reactiveStructure.instanceId);
			}
		},
		updateStructureQuantity: function (instanceId, value) {
			var structure = this.selectedStructures.find(function (s) {
				return s.instanceId === instanceId;
			});
			if (structure) {
				var newQuantity = parseInt(value) || 1;
				if (newQuantity < 1) newQuantity = 1;
				structure.quantity = newQuantity;
				console.log("Updated structure quantity:", structure.id, "instanceId:", instanceId, "quantity:", structure.quantity);
			}
		},
		removeStructure: function (instanceId) {
			var index = this.selectedStructures.findIndex(function (s) {
				return s.instanceId === instanceId;
			});
			if (index !== -1) {
				var removed = this.selectedStructures.splice(index, 1)[0];
				console.log("Removed structure:", removed.id, "instanceId:", instanceId);
			}
		},
		isStructureSelected: function (structureId) {
			return this.selectedStructures.some(function (s) {
				return s.id === structureId;
			});
		},
		clearAllStructures: function () {
			this.selectedStructures = [];
			this.instanceCounter = 0;
			console.log("Cleared all structures");
		},
		getWeaponIcon: function (weaponId) {
			return "/assets/weapons/" + weaponId + ".webp";
		},
		getStructureImage: function (structureId) {
			return "/assets/structures/" + structureId + ".webp";
		},
		getStructureRequirements: function (structure) {
			if (!structure || !structure.health || !structure.quantity) {
				console.warn("Invalid structure in getStructureRequirements:", structure);
				return [];
			}

			var health = (structure.useSoftside && structure.softsideHealth ? structure.softsideHealth : structure.health) * structure.quantity;
			var enabledWeapons = this.weapons
				.filter(function (w) {
					return w.damage > 0 && w.sulfurCost > 0;
				})
				.sort(function (a, b) {
					var aEfficiency = a.sulfurCost ? a.damage / a.sulfurCost : 0;
					var bEfficiency = b.sulfurCost ? b.damage / b.sulfurCost : 0;
					return bEfficiency - aEfficiency;
				});

			if (!enabledWeapons.length) {
				var c4 = this.weapons.find(function (w) {
					return w.id === "c4";
				});
				if (c4) {
					enabledWeapons = [c4];
				} else {
					return [];
				}
			}

			var requirements = [];
			var remainingHealth = health;

			for (var i = 0; i < enabledWeapons.length && remainingHealth > 0; i++) {
				var weapon = enabledWeapons[i];
				var maxCount = weapon.quantity > 0 ? weapon.quantity : Number.MAX_SAFE_INTEGER;
				var weaponCount = Math.min(Math.ceil(remainingHealth / (weapon.damage || 1)), maxCount);

				if (weaponCount > 0) {
					requirements.push({ weapon: weapon.id, quantity: weaponCount });
					remainingHealth -= weaponCount * (weapon.damage || 1);
				}
			}

			console.log("getStructureRequirements for", structure.id, "quantity:", structure.quantity, "health:", health, "requirements:", requirements);
			return requirements;
		},
		getAvailableWeaponsRequirements: function (structure) {
			if (!structure || !structure.health || !structure.quantity) {
				console.warn("Invalid structure in getAvailableWeaponsRequirements:", structure);
				return [];
			}

			var requirements = [];
			var totalRemainingHealth = 0;

			// Calculate per instance for unlimited weapons, track remaining quantity separately
			var weaponAvailability = {};
			this.weapons.forEach(function (w) {
				weaponAvailability[w.id] = { originalQuantity: w.quantity, remaining: w.quantity };
			});

			for (var i = 0; i < structure.quantity; i++) {
				var healthPerInstance = structure.useSoftside && structure.softsideHealth ? structure.softsideHealth : structure.health;
				totalRemainingHealth += healthPerInstance;

				var enabledWeapons = this.weapons
					.filter(function (w) {
						return (w.enabled && w.quantity === 0) || w.quantity > 0;
					})
					.sort(function (a, b) {
						var aEfficiency = a.sulfurCost ? a.damage / a.sulfurCost : 0;
						var bEfficiency = b.sulfurCost ? b.damage / b.sulfurCost : 0;
						return bEfficiency - aEfficiency;
					});

				if (!enabledWeapons.length) {
					var c4 = this.weapons.find(function (w) {
						return w.id === "c4";
					});
					if (c4) {
						enabledWeapons = [c4];
					} else {
						return [];
					}
				}

				var instanceRequirements = [];
				var instanceRemainingHealth = healthPerInstance;

				for (var j = 0; j < enabledWeapons.length && instanceRemainingHealth > 0; j++) {
					var weapon = enabledWeapons[j];
					var maxCount = weaponAvailability[weapon.id].remaining > 0 ? weaponAvailability[weapon.id].remaining : 0;
					var weaponCount = Math.min(Math.ceil(instanceRemainingHealth / (weapon.damage || 1)), maxCount);

					if (weaponCount > 0) {
						instanceRequirements.push({ weapon: weapon.id, quantity: weaponCount });
						instanceRemainingHealth -= weaponCount * (weapon.damage || 1);
						weaponAvailability[weapon.id].remaining -= weaponCount;
					}
				}

				// Aggregate requirements
				instanceRequirements.forEach(function (req) {
					var existingReq = requirements.find(function (r) {
						return r.weapon === req.weapon;
					});
					if (existingReq) {
						existingReq.quantity += req.quantity;
					} else {
						requirements.push({ weapon: req.weapon, quantity: req.quantity });
					}
				});
			}

			// Restore original quantities
			this.weapons.forEach(function (w) {
				w.quantity = weaponAvailability[w.id].originalQuantity;
			});

			console.log("getAvailableWeaponsRequirements for", structure.id, "quantity:", structure.quantity, "totalHealth:", totalRemainingHealth, "requirements:", requirements);
			return requirements;
		},
		getOneWeaponRequirements: function (structure) {
			if (!structure || !structure.health || !structure.quantity) {
				console.warn("Invalid structure in getOneWeaponRequirements:", structure);
				return [];
			}

			var health = (structure.useSoftside && structure.softsideHealth ? structure.softsideHealth : structure.health) * structure.quantity;
			var enabledWeapons = this.weapons
				.filter(function (w) {
					return (w.enabled && w.quantity === 0) || w.quantity > 0;
				})
				.sort(function (a, b) {
					var aEfficiency = a.sulfurCost ? a.damage / a.sulfurCost : 0;
					var bEfficiency = b.sulfurCost ? b.damage / b.sulfurCost : 0;
					return bEfficiency - aEfficiency;
				});

			if (!enabledWeapons.length) {
				var c4 = this.weapons.find(function (w) {
					return w.id === "c4";
				});
				if (c4) {
					enabledWeapons = [c4];
				} else {
					return [];
				}
			}

			var requirements = [];
			var remainingHealth = health;

			for (var i = 0; i < enabledWeapons.length; i++) {
				var weapon = enabledWeapons[i];
				var maxCount = weapon.quantity > 0 ? weapon.quantity : Number.MAX_SAFE_INTEGER;
				var weaponCount = Math.ceil(remainingHealth / (weapon.damage || 1));

				if (weaponCount <= maxCount) {
					requirements = [{ weapon: weapon.id, quantity: weaponCount }];
					remainingHealth = 0;
					break;
				}
			}

			console.log("getOneWeaponRequirements for", structure.id, "quantity:", structure.quantity, "health:", health, "requirements:", requirements);
			return requirements;
		},
		getStructureTime: function (structure) {
			var requirements = this.getStructureRequirements(structure);
			var totalTime = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? (weapon["attackTime"] || 5) * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getStructureTime for", structure.id, "quantity:", structure.quantity, ":", totalTime);
			return totalTime;
		},
		getAvailableWeaponsTime: function (structure) {
			var requirements = this.getAvailableWeaponsRequirements(structure);
			var totalTime = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? (weapon["attackTime"] || 5) * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getAvailableWeaponsTime for", structure.id, "quantity:", structure.quantity, ":", totalTime);
			return totalTime;
		},
		getOneWeaponTime: function (structure) {
			var requirements = this.getOneWeaponRequirements(structure);
			var totalTime = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? (weapon["attackTime"] || 5) * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getOneWeaponTime for", structure.id, "quantity:", structure.quantity, ":", totalTime);
			return totalTime;
		},
		getStructureSulfur: function (structure) {
			var requirements = this.getStructureRequirements(structure);
			var total = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? weapon.sulfurCost * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getStructureSulfur for", structure.id, "quantity:", structure.quantity, ":", total);
			return total;
		},
		getAvailableWeaponsSulfur: function (structure) {
			var requirements = this.getAvailableWeaponsRequirements(structure);
			var total = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? weapon.sulfurCost * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getAvailableWeaponsSulfur for", structure.id, "quantity:", structure.quantity, ":", total);
			return total;
		},
		getOneWeaponSulfur: function (structure) {
			var requirements = this.getOneWeaponRequirements(structure);
			var total = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? weapon.sulfurCost * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getOneWeaponSulfur for", structure.id, "quantity:", structure.quantity, ":", total);
			return total;
		},
		formatTime: function (seconds) {
			seconds = Math.round(seconds);
			var minutes = Math.floor(seconds / 60);
			var remainingSeconds = seconds % 60;
			return minutes + ":" + remainingSeconds.toString().padStart(2, "0");
		}
	}
}).mount("#app");
