const { createApp, reactive } = Vue;

createApp({
	data: function () {
		return {
			showWeaponsModal: false,
			structuresExpanded: false,
			selectedStructures: [],
			weapons: [],
			structures: [],
			instanceCounter: 0 // To generate unique instanceIds
		};
	},
	computed: {
		displayWeapons: function () {
			return this.weapons.slice(0, 7);
		},
		totalRequirements: function () {
			var requirements = {};
			var self = this;

			if (!this.selectedStructures || !this.selectedStructures.length) {
				return [];
			}

			this.selectedStructures.forEach(function (structure) {
				var structureReqs = self.getStructureRequirements(structure);
				if (structureReqs && structureReqs.length) {
					structureReqs.forEach(function (req) {
						if (req && req.weapon && typeof req.quantity === "number") {
							if (!requirements[req.weapon]) {
								requirements[req.weapon] = 0;
							}
							requirements[req.weapon] += req.quantity * structure.quantity;
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
				return total + self.getStructureTime(structure) * structure.quantity;
			}, 0);
			console.log("totalTime computed:", total);
			return total;
		},
		totalSulfur: function () {
			var self = this;
			var total = this.selectedStructures.reduce(function (total, structure) {
				return total + self.getStructureSulfur(structure) * structure.quantity;
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
							"enabled": saved.enabled || false,
							"quantity": saved.quantity || 0,
							"attack-time": weapon["attack-time"] || 5
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
					weapon.quantity = 0; // If quantity is set, set to 0
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
					weapon.enabled = false; // Disable if quantity is set
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
			return "/assets/" + weaponId + ".webp";
		},
		getStructureImage: function (structureId) {
			return "/assets/" + structureId + ".webp";
		},
		getStructureRequirements: function (structure) {
			if (!structure || !structure.health || !structure.quantity) {
				console.warn("Invalid structure in getStructureRequirements:", structure);
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
					console.warn("No enabled weapons or C4 fallback available");
					return [];
				}
			}

			var requirements = [];
			var remainingHealth = health;

			for (var i = 0; i < enabledWeapons.length; i++) {
				var weapon = enabledWeapons[i];
				if (remainingHealth <= 0) break;

				var maxCount = weapon.quantity > 0 ? weapon.quantity : weapon.id === "c4" ? 8 : weapon.id === "rocket" ? 4 : 63;
				var weaponCount = Math.min(Math.ceil(remainingHealth / (weapon.damage || 1)), maxCount);

				if (weaponCount > 0) {
					requirements.push({ weapon: weapon.id, quantity: weaponCount });
					remainingHealth -= weaponCount * (weapon.damage || 1);
				}

				if (requirements.length >= 3) break;
			}

			console.log("getStructureRequirements for", structure.id, "quantity:", structure.quantity, ":", requirements);
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

			var selectedWeapon =
				enabledWeapons[0] ||
				this.weapons.find(function (w) {
					return w.id === "c4";
				});
			if (!selectedWeapon) {
				console.warn("No enabled weapons or C4 fallback for one-weapon");
				return [];
			}

			var maxCount = selectedWeapon.quantity > 0 ? selectedWeapon.quantity : selectedWeapon.id === "c4" ? 8 : selectedWeapon.id === "rocket" ? 4 : 63;
			var weaponCount = Math.ceil(health / (selectedWeapon.damage || 1));
			if (weaponCount > maxCount) {
				console.warn("Required", weaponCount, "of", selectedWeapon.id, "exceeds available quantity", maxCount);
				return [];
			}

			var requirements = [{ weapon: selectedWeapon.id, quantity: weaponCount }];
			console.log("getOneWeaponRequirements for", structure.id, "quantity:", structure.quantity, ":", requirements);
			return requirements;
		},
		getStructureTime: function (structure) {
			var requirements = this.getStructureRequirements(structure);
			var totalTime = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? (weapon["attack-time"] || 5) * req.quantity : 0);
				}.bind(this),
				0
			);
			console.log("getStructureTime for", structure.id, "quantity:", structure.quantity, ":", totalTime);
			return totalTime;
		},
		getOneWeaponTime: function (structure) {
			var requirements = this.getOneWeaponRequirements(structure);
			var totalTime = requirements.reduce(
				function (total, req) {
					var weapon = this.weapons.find(function (w) {
						return w.id === req.weapon;
					});
					return total + (weapon ? (weapon["attack-time"] || 5) * req.quantity : 0);
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
			var minutes = Math.floor(seconds / 60);
			var remainingSeconds = seconds % 60;
			return minutes + ":" + remainingSeconds.toString().padStart(2, "0");
		}
	}
}).mount("#app");
