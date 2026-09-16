// MarcusFit 10.6.0: Basketball UX + Progression Maturation
// MarcusFit 10.3.0: Basketball-Specific AI Sync
// MarcusFit 10.2.0: Basketball Programs & Progression (accepted foundation)
// Basketball remains an isolated, final-load feature boundary. Core AI Sync
// stays authoritative; this file composes through its accepted extension hook.

(function(){
"use strict";

const MF_BASKETBALL_STORAGE_KEY = "mf-basketball-sessions";
const MF_BASKETBALL_SCHEMA_VERSION = 1;
const MF_BASKETBALL_PROGRAM_STATE_KEY = "mf-basketball-program-state";
const MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION = 1;
const MF_BASKETBALL_OVERRIDES_KEY = "mf-basketball-program-overrides";
const MF_BASKETBALL_OVERRIDES_SCHEMA_VERSION = 1;
const MF_BASKETBALL_PROPOSAL_KEY = "mf-basketball-proposal";
const MF_BASKETBALL_PROPOSAL_SCHEMA_VERSION = 1;
const MF_BASKETBALL_TRACKING_MODES = Object.freeze(["confidence","duration","makes_target","benchmark_shooting","count","completion"]);
const MF_BASKETBALL_TYPES = Object.freeze({
  skills_practice: "Skills Practice",
  shooting: "Shooting",
  pickup_game: "Pickup / Game",
  basketball_workout: "Basketball Workout",
  casual_play: "Casual Play",
  other: "Other"
});
const MF_BASKETBALL_LIMITS = Object.freeze({ minutes: 1440, count: 10000, notes: 2000, activeCalories: 5000, prescriptionText: 600 });
let mfBasketballProposalScrollLock = null;
let mfBasketballProposalReturnFocus = null;
let mfBasketballHowtoCounter = 0;

function mfBasketballDeepFreeze(value){
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  Object.keys(value).forEach(function(key){mfBasketballDeepFreeze(value[key]);});
  return Object.freeze(value);
}

const MF_BASKETBALL_PROGRAMS = mfBasketballDeepFreeze([
  {
    id:"basketball_fundamentals_3_session",version:1,name:"Basketball Fundamentals — 3 Session",
    description:"Balanced ball handling, finishing, shooting, and basketball conditioning.",
    sessions:[
      {id:"fundamentals_a_handle_weak_hand",name:"Session A — Handle + Weak Hand",focus:"Control the ball comfortably and finish with the weak hand.",drills:[
        {id:"fundamentals_weak_hand_stationary",name:"Weak-Hand Pound Dribble",trackingMode:"duration",confidence:true,target:{durationMinutes:5},progression:{drillId:"fundamentals_weak_hand_movement",name:"Moving Weak-Hand Control"}},
        {id:"fundamentals_crossover_control",name:"Crossover Control",trackingMode:"confidence",target:{durationMinutes:6},progression:{drillId:"fundamentals_crossover_movement",name:"Moving Crossovers"}},
        {id:"fundamentals_behind_back_foundation",name:"Behind-the-Back Foundation",trackingMode:"confidence",target:{durationMinutes:6},progression:{drillId:"fundamentals_behind_back_moving",name:"Moving Behind-the-Back"}},
        {id:"fundamentals_weak_hand_finishing",name:"Weak-Hand Finishing",trackingMode:"makes_target",confidence:true,target:{makes:15}},
        {id:"fundamentals_ft_benchmark",name:"Free Throws — Benchmark",trackingMode:"benchmark_shooting",target:{attempts:20,minAttempts:10}}
      ]},
      {id:"fundamentals_b_shooting",name:"Session B — Shooting",focus:"Build repeatable mechanics before adding game speed.",drills:[
        {id:"fundamentals_form_shooting",name:"Form Shooting",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"fundamentals_midrange_spots",name:"Midrange Spot Shooting",trackingMode:"makes_target",confidence:true,target:{makes:25},progression:{drillId:"fundamentals_midrange_movement",name:"Midrange Off Movement"}},
        {id:"fundamentals_catch_shoot",name:"Catch-and-Shoot",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"fundamentals_game_speed_makes",name:"Game-Speed Makes",trackingMode:"makes_target",confidence:true,target:{makes:15}},
        {id:"fundamentals_ft_finish",name:"Free Throw Finish",trackingMode:"makes_target",target:{makes:10}}
      ]},
      {id:"fundamentals_c_mixed_conditioning",name:"Session C — Mixed Skills + Conditioning",focus:"Blend movement skills and shooting while managing fatigue.",drills:[
        {id:"fundamentals_movement_handling",name:"Movement Handling",trackingMode:"duration",confidence:true,target:{durationMinutes:8}},
        {id:"fundamentals_finishing_challenge",name:"Finishing Challenge",trackingMode:"count",confidence:true,target:{count:20}},
        {id:"fundamentals_fatigue_shooting",name:"Shooting Under Fatigue",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"fundamentals_conditioning_block",name:"Basketball Conditioning",trackingMode:"completion"},
        {id:"fundamentals_mixed_benchmark",name:"Mixed Shooting Benchmark",trackingMode:"benchmark_shooting",target:{attempts:25,minAttempts:15}}
      ]}
    ]
  },
  {
    id:"guard_skills_3_session",version:1,name:"Guard Skills — 3 Session",
    description:"Advanced handling, change of pace, finishing, and shot creation.",
    sessions:[
      {id:"guard_a_handle_weak_hand",name:"Session A — Handle + Weak Hand",focus:"Strengthen weak-hand control and foundational change-of-direction moves.",drills:[
        {id:"guard_weak_hand_control",name:"Weak-Hand Control",trackingMode:"duration",confidence:true,target:{durationMinutes:6},progression:{drillId:"guard_weak_hand_movement",name:"Moving Weak-Hand Control"}},
        {id:"guard_crossover_change_direction",name:"Crossover Change of Direction",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_crossover_combo",name:"Crossover Combo"}},
        {id:"guard_behind_back_foundation",name:"Behind-the-Back",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_behind_back_moving",name:"Moving Behind-the-Back"}},
        {id:"guard_weak_hand_finishing",name:"Weak-Hand Finishing",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"guard_ft_benchmark",name:"Free Throws — Benchmark",trackingMode:"benchmark_shooting",target:{attempts:20,minAttempts:10}}
      ]},
      {id:"guard_b_change_of_pace",name:"Session B — Change of Pace",focus:"Create space with rhythm, hesitation, and linked moves.",drills:[
        {id:"guard_between_legs",name:"Between-the-Legs",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_between_legs_moving",name:"Moving Between-the-Legs"}},
        {id:"guard_hesitation",name:"Hesitation + Change of Pace",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_hesitation_attack",name:"Hesitation to Attack"}},
        {id:"guard_combo_moves",name:"Combo Moves",trackingMode:"count",confidence:true,target:{count:12}},
        {id:"guard_finish_contact",name:"Finishing Through Contact",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"guard_pullup_makes",name:"Pull-Up Makes",trackingMode:"makes_target",confidence:true,target:{makes:20}}
      ]},
      {id:"guard_c_creation",name:"Session C — Shot Creation",focus:"Connect movement handling to game-speed shooting.",drills:[
        {id:"guard_movement_handle",name:"Movement Handle",trackingMode:"duration",confidence:true,target:{durationMinutes:10}},
        {id:"guard_change_direction_combo",name:"Change-of-Direction Combo",trackingMode:"confidence",target:{durationMinutes:8}},
        {id:"guard_movement_shooting",name:"Shooting Off Movement",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"guard_pressure_makes",name:"Pressure Makes",trackingMode:"makes_target",confidence:true,target:{makes:10}},
        {id:"guard_three_benchmark",name:"3PT Benchmark",trackingMode:"benchmark_shooting",target:{attempts:25,minAttempts:15}}
      ]}
    ]
  },
  {
    id:"shooting_focus_2_session",version:1,name:"Shooting Focus — 2 Session",
    description:"Higher shooting volume with selective objective benchmarks.",
    sessions:[
      {id:"shooting_a_mechanics_volume",name:"Session A — Mechanics + Volume",focus:"Groove mechanics and accumulate quality makes from set spots.",drills:[
        {id:"shooting_form_makes",name:"Form Shooting",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"shooting_midrange_makes",name:"Midrange Makes",trackingMode:"makes_target",confidence:true,target:{makes:30}},
        {id:"shooting_spot_threes",name:"Spot Threes",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"shooting_ft_target",name:"Free Throw Makes",trackingMode:"makes_target",target:{makes:15}}
      ]},
      {id:"shooting_b_game_speed",name:"Session B — Game Speed + Pressure",focus:"Shoot off movement and finish with a measured benchmark.",drills:[
        {id:"shooting_game_speed",name:"Game-Speed Shooting",trackingMode:"makes_target",confidence:true,target:{makes:30}},
        {id:"shooting_movement",name:"Movement Shooting",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"shooting_pressure",name:"Pressure Makes",trackingMode:"makes_target",confidence:true,target:{makes:10}},
        {id:"shooting_ft_benchmark",name:"Free Throws — Benchmark",trackingMode:"benchmark_shooting",target:{attempts:25,minAttempts:15}}
      ]}
    ]
  }
]);

function mfBasketballPrescription(doNow,workRest,cues,success,setup,instructions,easier,harder,why){
  return {doNow:doNow,workRest:workRest,cues:cues,success:success,setup:setup,instructions:instructions,easier:easier,harder:harder,why:why};
}

const MF_BASKETBALL_PRESCRIPTIONS = mfBasketballDeepFreeze({
  fundamentals_weak_hand_stationary:mfBasketballPrescription("Pound the ball below your hip with only your weak hand; alternate waist-high and knee-high reps.","5 rounds of 45 sec work with 15 sec rest, including the final reset; total block: 5 min.",["Eyes forward","Keep the off arm active"],"Finish each round with no more than 2 lost balls.","Stand in an athletic stance with one ball and a clear 6-foot area.","Rounds 1–2 pound beside the hip, rounds 3–4 pound outside the knee, and round 5 change height on command.","Use 30-second rounds and look down only after a loss.","Add walking forward and backward without changing hands.","Builds dependable weak-hand control before movement."),
  fundamentals_crossover_control:mfBasketballPrescription("Make hard crossovers outside your knees, then attack two dribbles after every third crossover.","3 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 6 min.",["Low hips","Push the ball outside your frame"],"No more than 2 lost balls per round.","Use one ball and a line or cone in front of you.","Round 1 stationary, round 2 step laterally over the line, round 3 cross then take two game-speed attack dribbles.","Stay stationary and slow the attack dribbles.","Use a cone retreat, crossover, and explosive attack.","Teaches a controlled change of direction that transfers to drives."),
  fundamentals_behind_back_foundation:mfBasketballPrescription("Wrap the ball behind your hips from hand to hand, then take one controlled escape dribble.","3 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 6 min.",["Sit your hips back","Catch outside the opposite hip"],"Complete 20 clean transfers per round with 3 or fewer fumbles.","Stand over a court line with one ball and space behind you.","Start with stationary wraps, add a lateral step in round 2, then wrap and escape one dribble in round 3.","Use slow wraps without the escape dribble.","Add a retreat dribble before each wrap and accelerate out.","Builds safe behind-the-back mechanics before using the move at speed."),
  fundamentals_weak_hand_finishing:mfBasketballPrescription("Make 15 weak-hand finishes: 5 regular, 5 inside-hand, and 5 high off glass.","Alternate sides when practical; rest 20–30 sec after each group of 5.",["Last two steps under control","Protect the ball with your body"],"Make 15 with at least 3 of 5 in every group.","Start at the block with a ball; use both sides of the rim if available.","Attack from one step outside the lane, finish only with the weak hand, rebound, and reset to the next finish type.","Begin directly under the rim with no dribble.","Start at the wing and add a live change-of-direction move.","Turns weak-hand control into usable rim finishing."),
  fundamentals_ft_benchmark:mfBasketballPrescription("Shoot 20 free throws with the same routine and record makes and attempts.","4 sets of 5; take 20–30 sec between sets.",["Same breath and dribbles","Hold the finish"],"Complete at least 10 attempts; target a repeatable routine and honest percentage.","Use a regulation free-throw line and one ball.","Shoot in sets of five, recording every make and miss without restarting a set.","Move one step closer while keeping the routine.","Add a short down-and-back before each set of five.","Creates a comparable shooting baseline."),
  fundamentals_form_shooting:mfBasketballPrescription("Make 20 one-hand form shots from 3–6 feet, adding the guide hand only after 10 clean makes.","4 sets of 5 makes; reset 20 sec between sets.",["Elbow under the ball","Finish through the rim"],"At least 4 of each 5 attempts have balanced feet and a held follow-through.","Choose a close straight-on or slight-angle spot with one ball.","Shoot softly with full wrist extension, retrieve, and reset your feet before every repetition.","Shoot from 2–3 feet with one hand only.","Alternate five makes from the front and each side of the rim.","Grooves repeatable mechanics before adding range or speed."),
  fundamentals_midrange_spots:mfBasketballPrescription("Make 25 midrange shots: 5 from each baseline, elbow, and center spot.","Five spots × 5 makes; rest 30 sec after each spot.",["Feet set before the catch","Land balanced"],"Reach 25 makes in 50 attempts or fewer.","Mark five spots 10–15 feet from the rim; use a passer or self-toss.","Complete five makes at one spot before moving clockwise to the next.","Move each spot 2 feet closer.","Use a one-dribble pull-up at every spot.","Builds repeatable accuracy across common midrange locations."),
  fundamentals_catch_shoot:mfBasketballPrescription("Make 20 catch-and-shoot jumpers, squaring in the air before each catch.","4 sets of 5 makes with 30 sec rest.",["Show hands early","Dip and rise in one rhythm"],"At least 3 of 5 makes in each set before moving on.","Use four wing/corner spots with a passer or self-spin pass.","Start outside the spot, step into the catch, shoot without an extra dribble, and rotate after five makes.","Start already squared and use a self-toss.","Sprint into each spot or add a closeout target.","Connects set mechanics to receiving the ball."),
  fundamentals_game_speed_makes:mfBasketballPrescription("Make 15 game-speed shots after a sprint, cut, or hard one-dribble move.","3 sets of 5 makes; rest 45 sec between sets.",["Arrive on balance","Game speed into a calm release"],"Make at least 2 of the first 5 in every set without slowing the movement.","Choose three scoring spots and a cone 8–12 feet away.","Move hard away from the cone, plant into the shot, rebound, and repeat from a new angle.","Walk through the movement before each shot.","Add a defender cue or require 3 consecutive makes to finish a set.","Tests whether mechanics hold after realistic movement."),
  fundamentals_ft_finish:mfBasketballPrescription("Finish the workout by making 10 free throws with your normal routine.","Shoot in sets of 2; pause one full breath between sets.",["Reset after every shot","Hold the finish"],"Make 10 before 20 total attempts.","Use the regulation line and track all attempts.","Treat every pair like late-game free throws; step off the line and restart the routine after each pair.","Move one step closer.","A miss on the second shot adds one down-and-back before the next pair.","Reinforces calm mechanics at the end of practice."),
  fundamentals_movement_handling:mfBasketballPrescription("Dribble the court with weak-hand pushes, crossovers, retreats, and changes of pace.","4 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 8 min.",["Eyes scan the rim","Change speed after every move"],"Complete each round with 3 or fewer lost balls.","Use half court or a 20-foot lane with three cones.","Round 1 weak hand, round 2 crossover, round 3 retreat-and-attack, round 4 free combination at game pace.","Use two cones and walk each pattern.","Add a finish at the rim after every lane.","Blends stationary control into purposeful movement."),
  fundamentals_finishing_challenge:mfBasketballPrescription("Complete 20 finishes: 5 strong hand, 5 weak hand, 5 inside hand, and 5 reverse.","Four groups of 5; rest 30 sec between groups.",["Eyes on the square","Finish away from imaginary help"],"Record all 20 reps and make at least 3 in each group.","Start at either block with one ball and alternate sides.","Use one controlled approach dribble, finish the assigned type, rebound, and switch sides.","Remove the approach dribble and work directly under the rim.","Start at the wing and add a cone change of direction.","Expands finishing options without losing measurable volume."),
  fundamentals_fatigue_shooting:mfBasketballPrescription("Make 20 jumpers after a short movement burst before every shot.","4 sets of 5 makes; 20 sec work burst, then shoot; rest 45 sec between sets.",["Settle the feet before rising","Keep the release smooth"],"Reach 20 makes while keeping every movement burst honest.","Place one cone near the lane and choose four shooting spots.","Shuffle or sprint around the cone for 20 seconds, then shoot until five makes; repeat at the next spot.","Use a 10-second brisk walk instead of a sprint.","Use a full down-and-back and require game-range shots.","Practices shot mechanics while breathing hard."),
  fundamentals_conditioning_block:mfBasketballPrescription("Complete six full-court or sideline-to-sideline runs at a repeatable hard pace.","6 reps: 20–30 sec work / 40–60 sec walk-back recovery.",["Turn low and under control","Keep the final rep within 2 sec of the first"],"Complete all 6 reps without the last rep slowing more than about 10%.","Choose a clear court distance and a consistent start/finish line.","Run the same distance each rep, walk during recovery, and stop if mechanics become unsafe.","Do four half-court reps with 60 sec recovery.","Do eight reps or dribble a ball while maintaining control.","Builds basketball-specific repeat-effort conditioning."),
  fundamentals_mixed_benchmark:mfBasketballPrescription("Take 25 game-relevant shots from five spots and record every make and attempt.","5 spots × 5 attempts; rest 30 sec after each spot.",["Use the same shot at each spot","Record misses honestly"],"Complete at least 15 attempts and preserve the same spot order next time.","Choose five repeatable spots and mark them mentally or with cones.","Take exactly five shots per spot, rotating clockwise; do not replace misses.","Move all spots closer.","Add a one-dribble move before every shot.","Creates a repeatable mixed-shot benchmark."),
  guard_weak_hand_control:mfBasketballPrescription("Use only the weak hand through pounds, in-out dribbles, retreats, and two-dribble attacks.","4 rounds of 60 sec work with 30 sec rest, including the final reset; total block: 6 min.",["Ball outside the knee","Accelerate after the rhythm change"],"No more than 2 lost balls in any round.","Set two cones 10–15 feet apart with one ball.","Perform one pattern per round, traveling between cones and resetting under control.","Stay stationary for pounds and in-outs.","Add a live finish after every attack.","Builds guard-level weak-hand control under movement."),
  guard_crossover_change_direction:mfBasketballPrescription("Attack a cone, plant outside the frame, cross low, and accelerate for two dribbles.","4 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 8 min.",["Sell the first direction","Win the next two dribbles"],"Complete 8 clean changes per round with 2 or fewer fumbles.","Place one cone 10–15 feet away and leave an exit lane on both sides.","Approach under control, cross at the cone, burst past its hip, decelerate, and return from the other side.","Walk the approach and pause after the crossover.","Add a retreat setup or finish at the rim.","Trains a crossover that actually creates separation."),
  guard_behind_back_foundation:mfBasketballPrescription("Approach a cone, transfer behind the hips, and escape for two strong dribbles.","4 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 8 min.",["Ball travels behind the hips, not the back","Push off the outside foot"],"Complete 6 clean reps each direction per round.","Use one cone and a clear 15-foot lane.","Start slow, wrap behind at the cone, catch outside the far hip, and accelerate away.","Practice stationary transfers with a lateral step.","Add a retreat dribble before the move and a finish after it.","Turns the wrap into a protected direction change."),
  guard_weak_hand_finishing:mfBasketballPrescription("Make 20 weak-hand finishes: 5 extension, 5 inside-hand, 5 reverse, and 5 floaters.","Four groups of 5 makes; rest 30 sec between groups.",["Keep the ball away from the defender","Use the glass deliberately"],"Make at least 3 of the first 5 attempts in each finish type.","Begin at the wing or slot and attack with the weak hand.","Use one setup move, keep the final dribble low, and finish the assigned type before rotating.","Start from the block with no setup move.","Add a pad/contact cue or a hard closeout cone.","Expands reliable weak-hand scoring options."),
  guard_ft_benchmark:mfBasketballPrescription("Shoot 20 free throws in four pressure sets and record makes and attempts.","4 sets of 5 with 30 sec between sets.",["Identical routine","Reset emotionally after every result"],"Complete all 20 and keep the routine unchanged.","Use the regulation line and a written or mental set tally.","Shoot five, record the set, step away, and repeat without replacing misses.","Shoot from one step closer.","Add a down-and-back before each set.","Tracks free-throw consistency for a guard workload."),
  guard_between_legs:mfBasketballPrescription("Drive toward a cone, transfer between the legs, and burst into the new lane.","4 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 8 min.",["Step long before the transfer","Catch the ball outside the hip"],"Complete 8 clean transfers per round with no upright pauses.","Place a cone 12 feet away with open space to both sides.","Approach, split the stance, transfer under the lead leg, and take two explosive escape dribbles.","Practice stationary transfers with a wide stance.","Add between-the-legs into crossover or a pull-up.","Builds a protected change-of-direction option."),
  guard_hesitation:mfBasketballPrescription("Attack at medium pace, rise into a hesitation, then explode past the cone.","4 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 8 min.",["Change body height, not just hand speed","First attack dribble reaches past the cone"],"Complete 6 convincing hesitations each hand per round.","Set one cone as a defender and use a 15-foot attack lane.","Approach, briefly lift the eyes and torso, keep the dribble alive, then accelerate for two dribbles.","Use one hand only and walk through the speed change.","Add a crossover after the hesitation or finish at the rim.","Develops pace control to move a defender without contact."),
  guard_combo_moves:mfBasketballPrescription("Complete 12 game-speed combinations: crossover-to-between, between-to-behind, and hesitation-to-crossover.","3 combinations × 4 clean reps; rest 30 sec between combinations.",["Every move changes direction or pace","Exit the combo in two dribbles"],"Record 12 clean reps with no more than 3 restarts.","Use two cones 10 feet apart and one ball.","Perform four clean reps of each named combo, alternating the attacking hand.","Choose two combinations and perform them at controlled speed.","Add a finish or pull-up after every combination.","Links individual moves into usable guard sequences."),
  guard_finish_contact:mfBasketballPrescription("Make 20 finishes through controlled contact: 5 each shoulder on both sides.","4 groups of 5 makes with 40 sec rest.",["Initiate contact before extending","Keep eyes on the rim"],"Make at least 3 of the first 5 in every group.","Use a pad or safely bump your own shoulder against a stationary cue; never use unsafe contact.","Attack from the lane line, absorb light contact on the gather, and finish high off glass.","Remove contact and start from the block.","Add a change-of-direction setup before contact.","Builds balance and ball protection at the rim."),
  guard_pullup_makes:mfBasketballPrescription("Make 20 pull-ups: 5 going each direction from both elbows.","4 sets of 5 makes; rest 35 sec between sets.",["Stop hips under shoulders","Rise straight up"],"Reach 20 makes in 45 attempts or fewer.","Start at the wing with a cone near the elbow.","Attack the cone with two hard dribbles, stop on balance, shoot, and alternate directions after five makes.","Start closer and use one slow dribble.","Add a retreat or hesitation before the pull-up.","Develops balanced scoring after the dribble."),
  guard_movement_handle:mfBasketballPrescription("Run a full movement circuit: weak-hand push, retreat, crossover, between-legs, and behind-back exits.","5 stations of 45 sec work with 15 sec transition, including the final reset; complete 2 circuits; total block: 10 min.",["Scan ahead","Explode out of every move"],"Complete both circuits with no more than 5 total lost balls.","Set four cones in a zigzag across half court.","Assign one move to each turn, change pace between cones, and switch the starting hand on circuit two.","Use three cones and controlled speed.","Finish every circuit with a rim attack or pull-up.","Combines guard moves into continuous court navigation."),
  guard_change_direction_combo:mfBasketballPrescription("Use crossover, between-legs, and behind-back in a three-cone change-of-direction sequence.","4 rounds of 90 sec work with 30 sec rest, including the final reset; total block: 8 min.",["One sharp plant per turn","Accelerate between cones"],"Complete 4 clean trips per round with no skipped move.","Place three cones in a zigzag 8–10 feet apart.","Attack each cone, use the assigned move to change direction, and finish through the final cone at speed.","Use two cones and only crossover plus between-legs.","Call moves randomly or add a shot after the final cone.","Tests decision-ready direction changes under continuous movement."),
  guard_movement_shooting:mfBasketballPrescription("Make 25 shots off cuts, relocations, or one-dribble escapes from five spots.","5 spots × 5 makes; rest 40 sec after each spot.",["Sprint into balanced feet","Eyes find the rim before the catch"],"Reach 25 makes in 60 attempts or fewer.","Use five perimeter spots with a passer or self-toss.","Use a different movement entry at each spot, complete five makes, then rotate.","Use stationary catch-and-shoot reps.","Add a hard closeout cue and choose shoot or one-dribble escape.","Connects guard movement to a stable release."),
  guard_pressure_makes:mfBasketballPrescription("Make 10 pressure shots; every miss requires the next shot from the same spot.","Two sets of 5 makes with 60 sec rest.",["Full routine under pressure","Do not rush after a miss"],"Finish each set within 12 attempts.","Choose two game-relevant spots and track attempts.","Stay at the first spot until five makes, rest, then repeat at the second spot.","Use closer spots and allow 15 attempts per set.","Require two consecutive makes to close each set.","Builds composure when each result matters."),
  guard_three_benchmark:mfBasketballPrescription("Take 25 threes from five repeatable spots and record every make and attempt.","5 spots × 5 attempts; rest 30 sec after each spot.",["Same depth and routine every time","Land balanced"],"Complete at least 15 attempts and preserve the same locations next time.","Use both corners, both wings, and the top at your honest range.","Take exactly five shots at each spot and rotate in the same order without replacing misses.","Step inside the arc while keeping the five-spot pattern.","Use movement into every catch or add a short sprint between spots.","Creates a comparable perimeter benchmark."),
  shooting_form_makes:mfBasketballPrescription("Make 25 close form shots with a quiet guide hand and full follow-through.","5 sets of 5 makes; 20 sec reset between sets.",["Finish through the center of the rim","Hold balance until the ball lands"],"At least 4 of 5 attempts in each set show clean alignment.","Choose five close angles 3–6 feet from the rim.","Make five at each angle, resetting grip and feet before every shot.","Move to 2–3 feet and use one hand.","Step back after every clean set while preserving form.","Establishes mechanics before the higher-volume shooting work."),
  shooting_midrange_makes:mfBasketballPrescription("Make 30 midrange shots from six spots, five makes per spot.","6 spots × 5 makes; rest 30 sec after every two spots.",["Feet ready before the ball arrives","Same release on every angle"],"Reach 30 makes in 60 attempts or fewer.","Mark six spots from 10–16 feet with a passer or self-toss.","Stay at each spot until five makes, then rotate around the floor.","Move each spot closer and remove one location.","Alternate catch-and-shoot and one-dribble pull-ups.","Builds accurate volume from repeatable scoring locations."),
  shooting_spot_threes:mfBasketballPrescription("Make 25 threes from five spots, five makes at each.","5 spots × 5 makes; rest 40 sec after each spot.",["Load before the catch","Do not drift on the landing"],"Reach 25 makes in 70 attempts or fewer.","Use regulation or honest-range corner, wing, and top spots.","Complete five makes at each spot in the same order and count every attempt.","Step inside your comfortable range.","Sprint from the paint into each catch.","Accumulates measurable perimeter volume."),
  shooting_ft_target:mfBasketballPrescription("Make 15 free throws with the same pre-shot routine.","3 sets of 5 makes; rest 30 sec between sets.",["Breathe before starting","Hold the finish"],"Make 15 within 25 attempts.","Use the regulation line and track all attempts.","Stay at the line until five makes, step away for the rest, and repeat.","Move one step closer.","Require the fifth make of each set to be consecutive with the fourth.","Reinforces repeatable free-throw execution."),
  shooting_game_speed:mfBasketballPrescription("Make 30 game-speed shots after cuts, sprints, or hard one-dribble entries.","6 sets of 5 makes with 45 sec rest.",["Fast feet into a calm release","Stop momentum before rising"],"Reach 30 makes while keeping movement speed consistent.","Use six perimeter or midrange spots with a cone and passer/self-toss.","Assign one movement entry per spot, make five, then rotate without reducing pace.","Use shorter movement and closer spots.","Add a decision cue between catch-and-shoot and one-dribble pull-up.","Tests shooting mechanics at realistic pace and volume."),
  shooting_movement:mfBasketballPrescription("Make 25 shots using flare, curl, drift, lift, and relocation footwork.","5 movements × 5 makes; rest 40 sec between movements.",["Create separation before showing hands","Square before the release"],"Make at least 3 of the first 6 attempts for every movement.","Use one cone as a screen and five repeatable shooting areas.","Perform one movement pattern until five makes, then change both location and footwork.","Use only drift and lift at controlled speed.","Add a closeout read and one-dribble counter.","Builds a broad, game-relevant off-ball shooting menu."),
  shooting_pressure:mfBasketballPrescription("Make 10 pressure shots in two sets; a set ends only at five makes.","2 sets of 5 makes; 60 sec rest; cap each set at 12 attempts.",["Commit to the routine","Respond to misses with the same tempo"],"Finish both sets within their 12-attempt caps.","Choose two shots you expect to get in games.","Track attempts, remain at the spot until five makes or the cap, then record the result and rest.","Use closer shots and a 15-attempt cap.","Require the final two makes of each set to be consecutive.","Adds consequence without changing shot mechanics."),
  shooting_ft_benchmark:mfBasketballPrescription("Shoot 25 free throws in five sets and record all makes and attempts.","5 sets of 5 with 30 sec rest.",["Identical routine","Hold the finish until the ball lands"],"Complete at least 15 attempts with no replaced misses.","Use the regulation line and keep a set-by-set tally.","Shoot five, record the set, step away, and repeat in the same order next time.","Shoot from one step closer.","Add a short sprint before each set or require a consequence for sub-target sets.","Provides a repeatable end-of-session accuracy benchmark.")
});

function mfBasketballGetProgram(programId,version){
  return MF_BASKETBALL_PROGRAMS.find(function(program){return program.id===programId&&(version==null||program.version===Number(version));})||null;
}

function mfBasketballClone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function mfBasketballStableValue(value){
  if(Array.isArray(value))return value.map(mfBasketballStableValue);
  if(value&&typeof value==="object")return Object.keys(value).sort().reduce(function(out,key){out[key]=mfBasketballStableValue(value[key]);return out;},{});
  return value;
}

function mfBasketballFingerprint(value){
  const text=JSON.stringify(mfBasketballStableValue(value));let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return "bball-fp-"+(hash>>>0).toString(16).padStart(8,"0");
}

function mfBasketballDefaultOverrides(){
  return {schemaVersion:MF_BASKETBALL_OVERRIDES_SCHEMA_VERSION,programs:{},updatedAt:null};
}

function mfBasketballValidateTarget(target,mode,options){
  options=options||{};const errors=[],warnings=[],value=target==null?null:target;
  if(value!==null&&(typeof value!=="object"||Array.isArray(value)))return {valid:false,target:null,errors:["Target must be an object."],warnings:[]};
  const allowed={confidence:["durationMinutes"],duration:["durationMinutes"],makes_target:["makes"],benchmark_shooting:["attempts","minAttempts"],count:["count"],completion:[]}[mode];
  if(!allowed)return {valid:false,target:null,errors:["Tracking mode is unsupported."],warnings:[]};
  const keys=value?Object.keys(value):[];
  keys.forEach(function(key){if(allowed.indexOf(key)===-1)errors.push("Target field "+key+" is not allowed for "+mode+".");});
  const out={};
  function number(key,max,required,allowZero){
    if(!value||value[key]==null){if(required)errors.push("Target "+key+" is required for "+mode+".");return;}
    const n=Number(value[key]);if(!Number.isFinite(n)||!Number.isInteger(n)||n<0||(!allowZero&&n===0)||n>max)errors.push("Target "+key+" is outside the safe basketball range.");else out[key]=n;
  }
  if(mode==="confidence")number("durationMinutes",120,false,false);
  if(mode==="duration")number("durationMinutes",120,true,false);
  if(mode==="makes_target")number("makes",250,true,false);
  if(mode==="benchmark_shooting"){number("attempts",500,true,false);number("minAttempts",500,true,false);if(out.minAttempts!=null&&out.attempts!=null&&out.minAttempts>out.attempts)errors.push("Benchmark minimum attempts cannot exceed planned attempts.");}
  if(mode==="count")number("count",500,true,false);
  if(mode==="completion"&&keys.length)errors.push("Completion drills do not accept numeric targets.");
  const prior=options.priorTarget||null;
  Object.keys(out).forEach(function(key){const before=prior&&Number(prior[key]);if(!Number.isFinite(before)||before<=0)return;if(out[key]>before*3)errors.push("Target "+key+" is too large relative to the current basketball target.");else if(out[key]>before*1.5||out[key]<before*.5)warnings.push("Target "+key+" changes by more than 50%.");});
  return {valid:errors.length===0,target:Object.keys(out).length?out:null,errors:errors,warnings:warnings};
}

function mfBasketballValidateDrillDefinition(raw,options){
  options=options||{};const errors=[],warnings=[],source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const id=String(source.id||options.id||"").trim(),name=String(source.name||"").trim(),mode=String(source.trackingMode||"").trim();
  if(!/^bball-ai-[a-z0-9][a-z0-9-]*-v[1-9][0-9]*$/.test(id))errors.push("AI-added drill ID must use bball-ai-…-vN.");
  if(!name||name.length>120)errors.push("Drill name must be 1 to 120 characters.");
  if(MF_BASKETBALL_TRACKING_MODES.indexOf(mode)===-1)errors.push("Drill tracking mode is unsupported.");
  const targetResult=mfBasketballValidateTarget(source.target==null?null:source.target,mode);errors.push.apply(errors,targetResult.errors);warnings.push.apply(warnings,targetResult.warnings);
  const allowed=["id","name","trackingMode","confidence","target","rationale","source","addedByProposalId"];
  Object.keys(source).forEach(function(key){if(allowed.indexOf(key)===-1)errors.push("Added drill field "+key+" is unsupported.");});
  if(source.confidence!=null&&typeof source.confidence!=="boolean")errors.push("Drill confidence flag must be true or false.");
  const drill={id:id,name:name,trackingMode:mode};if(source.confidence===true)drill.confidence=true;if(targetResult.target)drill.target=targetResult.target;
  if(source.rationale){const rationale=String(source.rationale).trim();if(rationale.length>500)errors.push("Drill rationale must be 500 characters or fewer.");else drill.rationale=rationale;}
  if(source.source)drill.source=String(source.source);if(source.addedByProposalId)drill.addedByProposalId=String(source.addedByProposalId);
  return {valid:errors.length===0,drill:drill,errors:errors,warnings:warnings};
}

function mfBasketballNormalizeOverrides(input,options){
  options=options||{};const errors=[],source=input&&typeof input==="object"&&!Array.isArray(input)?input:null,out=mfBasketballDefaultOverrides();
  if(!source)return {ok:false,errors:["Basketball overrides must be an object."],store:out};
  if(Number(source.schemaVersion)!==MF_BASKETBALL_OVERRIDES_SCHEMA_VERSION)errors.push("Basketball override schema is unsupported.");
  if(source.updatedAt!=null&&!mfBasketballIsIsoTimestamp(source.updatedAt))errors.push("Basketball override updatedAt is malformed.");
  if(!source.programs||typeof source.programs!=="object"||Array.isArray(source.programs))errors.push("Basketball override programs must be an object.");
  const programs=source.programs&&typeof source.programs==="object"&&!Array.isArray(source.programs)?source.programs:{};
  Object.keys(programs).forEach(function(programId){
    const rawProgram=programs[programId],base=mfBasketballGetProgram(programId,rawProgram&&rawProgram.baseVersion);
    if(!base){errors.push("Override references an unknown basketball program/version: "+programId+".");return;}
    if(!rawProgram||typeof rawProgram!=="object"||Array.isArray(rawProgram)||!rawProgram.sessions||typeof rawProgram.sessions!=="object"||Array.isArray(rawProgram.sessions)){errors.push("Override program "+programId+" is malformed.");return;}
    const programOut={baseVersion:base.version,sessions:{}};
    Object.keys(rawProgram.sessions).forEach(function(sessionId){
      const baseSession=base.sessions.find(function(session){return session.id===sessionId;}),rawSession=rawProgram.sessions[sessionId];
      if(!baseSession){errors.push("Override references an unknown planned session: "+sessionId+".");return;}
      if(!rawSession||typeof rawSession!=="object"||Array.isArray(rawSession)){errors.push("Override session "+sessionId+" is malformed.");return;}
      const sessionOut={modified:{},added:{},disabled:{}};
      const added=rawSession.added&&typeof rawSession.added==="object"&&!Array.isArray(rawSession.added)?rawSession.added:{};
      Object.keys(added).forEach(function(drillId){const validation=mfBasketballValidateDrillDefinition(added[drillId],{id:drillId});if(!validation.valid||validation.drill.id!==drillId){errors.push.apply(errors,validation.errors.map(function(error){return sessionId+": "+error;}));if(validation.drill.id!==drillId)errors.push("Added drill ID does not match its override key.");return;}sessionOut.added[drillId]=validation.drill;});
      const knownIds=baseSession.drills.map(function(drill){return drill.id;}).concat(Object.keys(sessionOut.added));
      const modified=rawSession.modified&&typeof rawSession.modified==="object"&&!Array.isArray(rawSession.modified)?rawSession.modified:{};
      Object.keys(modified).forEach(function(drillId){const fields=modified[drillId];if(knownIds.indexOf(drillId)===-1||!fields||typeof fields!=="object"||Array.isArray(fields)){errors.push("Modified drill override is invalid: "+drillId+".");return;}const allowed=["name","target","confidence","source","proposalId"];if(Object.keys(fields).some(function(key){return allowed.indexOf(key)===-1;})){errors.push("Modified drill "+drillId+" contains unsupported fields.");return;}const baseDrill=baseSession.drills.find(function(drill){return drill.id===drillId;})||sessionOut.added[drillId],safe={};if(fields.name!=null){const name=String(fields.name).trim();if(!name||name.length>120)errors.push("Modified drill name is invalid: "+drillId+".");else safe.name=name;}if(fields.confidence!=null){if(typeof fields.confidence!=="boolean")errors.push("Modified confidence flag is invalid: "+drillId+".");else safe.confidence=fields.confidence;}if(fields.target!=null){const result=mfBasketballValidateTarget(fields.target,baseDrill.trackingMode,{priorTarget:baseDrill.target});if(!result.valid)errors.push.apply(errors,result.errors.map(function(error){return drillId+": "+error;}));else safe.target=result.target;}if(fields.source)safe.source=String(fields.source);if(fields.proposalId)safe.proposalId=String(fields.proposalId);sessionOut.modified[drillId]=safe;});
      const disabled=rawSession.disabled&&typeof rawSession.disabled==="object"&&!Array.isArray(rawSession.disabled)?rawSession.disabled:{};Object.keys(disabled).forEach(function(drillId){if(knownIds.indexOf(drillId)===-1||disabled[drillId]!==true)errors.push("Disabled drill override is invalid: "+drillId+".");else sessionOut.disabled[drillId]=true;});
      const enabledIds=knownIds.filter(function(id){return !sessionOut.disabled[id];});
      if(rawSession.order!=null){if(!Array.isArray(rawSession.order)||new Set(rawSession.order).size!==rawSession.order.length||rawSession.order.length!==enabledIds.length||rawSession.order.some(function(id){return enabledIds.indexOf(id)===-1;}))errors.push("Override order is invalid for session "+sessionId+".");else sessionOut.order=rawSession.order.slice();}
      if(Object.keys(sessionOut.modified).length||Object.keys(sessionOut.added).length||Object.keys(sessionOut.disabled).length||sessionOut.order)programOut.sessions[sessionId]=sessionOut;
    });
    if(Object.keys(programOut.sessions).length)out.programs[programId]=programOut;
  });
  out.updatedAt=source.updatedAt==null?null:new Date(source.updatedAt).toISOString();
  return {ok:errors.length===0,errors:errors,store:errors.length&&options.strict?mfBasketballDefaultOverrides():out};
}

function mfBasketballParseOverridesValue(raw,options){
  if(raw==null||raw==="")return {parseOk:true,keyExists:false,error:null,store:mfBasketballDefaultOverrides()};
  let parsed;try{parsed=typeof raw==="string"?JSON.parse(raw):raw;}catch(e){return {parseOk:false,keyExists:true,error:"Basketball overrides are not valid JSON.",store:mfBasketballDefaultOverrides()};}
  const normalized=mfBasketballNormalizeOverrides(parsed,Object.assign({strict:true},options));return {parseOk:normalized.ok,keyExists:true,error:normalized.ok?null:normalized.errors.join(" "),store:normalized.store};
}

function mfBasketballReadOverrides(){
  try{return mfBasketballParseOverridesValue(localStorage.getItem(MF_BASKETBALL_OVERRIDES_KEY));}catch(e){return {parseOk:false,keyExists:false,error:"Basketball overrides could not be read.",store:mfBasketballDefaultOverrides()};}
}

function mfBasketballWriteOverrides(store,nowValue){
  const candidate=mfBasketballClone(store);candidate.updatedAt=new Date(nowValue||new Date()).toISOString();const normalized=mfBasketballNormalizeOverrides(candidate,{strict:true});if(!normalized.ok)throw new Error(normalized.errors.join(" "));localStorage.setItem(MF_BASKETBALL_OVERRIDES_KEY,JSON.stringify(normalized.store));return normalized.store;
}

function mfBasketballGetResolvedProgram(programId,version,overrideValue){
  const base=mfBasketballGetProgram(programId,version);if(!base)return null;
  const parsed=overrideValue&&overrideValue.store?overrideValue:overrideValue?mfBasketballParseOverridesValue(overrideValue):mfBasketballReadOverrides(),resolved=mfBasketballClone(base),programOverride=parsed.parseOk&&parsed.store.programs[base.id];
  if(!programOverride||programOverride.baseVersion!==base.version)return resolved;
  resolved.sessions.forEach(function(session){const overlay=programOverride.sessions[session.id];if(!overlay)return;const additions=Object.keys(overlay.added||{}).map(function(id){return mfBasketballClone(overlay.added[id]);});let drills=session.drills.concat(additions).filter(function(drill){return !(overlay.disabled&&overlay.disabled[drill.id]);});drills=drills.map(function(drill){const fields=overlay.modified&&overlay.modified[drill.id];if(!fields)return drill;const next=Object.assign({},drill,mfBasketballClone(fields));delete next.source;delete next.proposalId;next.personalization={source:fields.source||"personalized",proposalId:fields.proposalId||null};return next;});if(overlay.order){const byId={};drills.forEach(function(drill){byId[drill.id]=drill;});drills=overlay.order.map(function(id){return byId[id];}).filter(Boolean);}session.drills=drills;});
  return resolved;
}

function mfBasketballDefaultProgramState(){
  return {schemaVersion:MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION,activeProgramId:null,activeProgramVersion:null,nextSessionIndex:0,selectedAt:null,updatedAt:null};
}

function mfBasketballNormalizeProgramState(input,options){
  options=options||{};
  const errors=[],value=input&&typeof input==="object"&&!Array.isArray(input)?input:null;
  if(!value)return {ok:false,errors:["Basketball program state must be an object."],state:mfBasketballDefaultProgramState()};
  if(Number(value.schemaVersion)!==MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION)errors.push("Basketball program state schema is unsupported.");
  const activeProgramId=value.activeProgramId==null?null:String(value.activeProgramId);
  const activeProgramVersion=value.activeProgramVersion==null?null:Number(value.activeProgramVersion);
  const program=activeProgramId?mfBasketballGetProgram(activeProgramId,activeProgramVersion):null;
  if(activeProgramId&&!program)errors.push("Basketball program identity is unsupported.");
  if(!activeProgramId&&value.activeProgramVersion!=null)errors.push("Basketball program version requires an active program.");
  const nextSessionIndex=Number(value.nextSessionIndex);
  if(!Number.isInteger(nextSessionIndex)||nextSessionIndex<0||(program&&nextSessionIndex>=program.sessions.length))errors.push("Basketball next-session position is invalid.");
  ["selectedAt","updatedAt"].forEach(function(key){if(value[key]!=null&&!mfBasketballIsIsoTimestamp(value[key]))errors.push("Basketball program "+key+" is malformed.");});
  if(errors.length)return {ok:false,errors:errors,state:mfBasketballDefaultProgramState()};
  return {ok:true,errors:[],state:{schemaVersion:MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION,activeProgramId:activeProgramId,activeProgramVersion:activeProgramVersion,nextSessionIndex:nextSessionIndex,selectedAt:value.selectedAt==null?null:new Date(value.selectedAt).toISOString(),updatedAt:value.updatedAt==null?null:new Date(value.updatedAt).toISOString()}};
}

function mfBasketballParseProgramStateValue(raw){
  if(raw==null||raw==="")return {parseOk:true,keyExists:false,error:null,state:mfBasketballDefaultProgramState()};
  let parsed;try{parsed=typeof raw==="string"?JSON.parse(raw):raw;}catch(e){return {parseOk:false,keyExists:true,error:"Basketball program state is not valid JSON.",state:mfBasketballDefaultProgramState()};}
  const normalized=mfBasketballNormalizeProgramState(parsed,{stored:true});
  return {parseOk:normalized.ok,keyExists:true,error:normalized.ok?null:normalized.errors.join(" "),state:normalized.state};
}

function mfBasketballReadProgramState(){
  try{return mfBasketballParseProgramStateValue(localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY));}
  catch(e){return {parseOk:false,keyExists:false,error:"Basketball program state could not be read.",state:mfBasketballDefaultProgramState()};}
}

function mfBasketballWriteProgramState(state){
  const normalized=mfBasketballNormalizeProgramState(state,{stored:true});
  if(!normalized.ok)throw new Error(normalized.errors.join(" "));
  localStorage.setItem(MF_BASKETBALL_PROGRAM_STATE_KEY,JSON.stringify(normalized.state));
  return normalized.state;
}

function mfBasketballSelectProgram(programId,nowValue){
  const program=mfBasketballGetProgram(String(programId||""));if(!program)return {ok:false,error:"Choose a valid basketball program.",state:mfBasketballDefaultProgramState()};
  const now=new Date(nowValue||new Date()).toISOString();
  const state={schemaVersion:MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION,activeProgramId:program.id,activeProgramVersion:program.version,nextSessionIndex:0,selectedAt:now,updatedAt:now};
  try{return {ok:true,error:null,state:mfBasketballWriteProgramState(state)};}catch(e){return {ok:false,error:"Basketball program selection could not be saved.",state:mfBasketballDefaultProgramState()};}
}

function mfBasketballAdvanceProgramState(nowValue){
  const current=mfBasketballReadProgramState();if(!current.parseOk||!current.state.activeProgramId)return {ok:false,error:current.error||"No basketball program is active.",state:current.state};
  const program=mfBasketballGetProgram(current.state.activeProgramId,current.state.activeProgramVersion);if(!program)return {ok:false,error:"The active basketball program is unavailable.",state:current.state};
  const state=Object.assign({},current.state,{nextSessionIndex:(current.state.nextSessionIndex+1)%program.sessions.length,updatedAt:new Date(nowValue||new Date()).toISOString()});
  try{return {ok:true,error:null,state:mfBasketballWriteProgramState(state)};}catch(e){return {ok:false,error:"Basketball program progress could not be saved.",state:current.state};}
}

function mfBasketballRestartProgram(nowValue){
  const current=mfBasketballReadProgramState();if(!current.parseOk||!current.state.activeProgramId)return {ok:false,error:current.error||"No basketball program is active.",state:current.state};
  const state=Object.assign({},current.state,{nextSessionIndex:0,updatedAt:new Date(nowValue||new Date()).toISOString()});
  try{return {ok:true,error:null,state:mfBasketballWriteProgramState(state)};}catch(e){return {ok:false,error:"Basketball program could not be restarted.",state:current.state};}
}

function mfBasketballNormalizeProposal(raw){
  const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?mfBasketballClone(raw):{},now=new Date().toISOString();
  return {
    schemaVersion:source.schemaVersion==null?MF_BASKETBALL_PROPOSAL_SCHEMA_VERSION:Number(source.schemaVersion),
    proposalVersion:source.proposalVersion==null?1:Number(source.proposalVersion),
    proposalId:String(source.proposalId||"").trim(),status:String(source.status||"pending").toLowerCase(),source:String(source.source||"ai_sync"),
    createdAt:source.createdAt||now,updatedAt:source.updatedAt||source.createdAt||now,summary:String(source.summary||"").trim(),rationale:String(source.rationale||"").trim(),
    changes:Array.isArray(source.changes)?source.changes.map(mfBasketballClone):[],validation:source.validation&&typeof source.validation==="object"?mfBasketballClone(source.validation):{valid:false,warnings:[],errors:[]},
    applyState:source.applyState&&typeof source.applyState==="object"?mfBasketballClone(source.applyState):null,undoSnapshot:source.undoSnapshot&&typeof source.undoSnapshot==="object"?mfBasketballClone(source.undoSnapshot):null
  };
}

function mfBasketballAllKnownDrillIds(overrides){
  const ids=new Set();MF_BASKETBALL_PROGRAMS.forEach(function(program){program.sessions.forEach(function(session){session.drills.forEach(function(drill){ids.add(drill.id);});});});
  const store=overrides&&overrides.programs?overrides:mfBasketballReadOverrides().store;Object.keys(store.programs||{}).forEach(function(programId){Object.keys(store.programs[programId].sessions||{}).forEach(function(sessionId){Object.keys(store.programs[programId].sessions[sessionId].added||{}).forEach(function(drillId){ids.add(drillId);});});});return ids;
}

function mfBasketballProposalSession(working,programId,version,sessionId,overrides){
  const program=working[programId]||(working[programId]=mfBasketballGetResolvedProgram(programId,version,overrides));return program&&program.version===Number(version)?program.sessions.find(function(session){return session.id===sessionId;})||null:null;
}

function mfBasketballExpectedProgramState(state){
  return {activeProgramId:state.activeProgramId,activeProgramVersion:state.activeProgramVersion,nextSessionIndex:state.nextSessionIndex};
}

function mfBasketballCheckExpected(change,key,current,captureExpectedState,conflicts,conflictId){
  if(!Object.prototype.hasOwnProperty.call(change,key)){
    if(captureExpectedState){change[key]=mfBasketballClone(current);return true;}
    conflicts.push(conflictId);return false;
  }
  const matches=typeof current==="string"?change[key]===current:mfBasketballFingerprint(change[key])===mfBasketballFingerprint(current);
  if(!matches)conflicts.push(conflictId);return matches;
}

function mfBasketballValidateProposal(raw,options){
  options=options||{};const captureExpectedState=options.captureExpectedState===true,proposal=mfBasketballNormalizeProposal(raw),errors=[],warnings=[],supported=[],conflicts=[],working={},overrideResult=options.overrides&&options.overrides.store?options.overrides:options.overrides?mfBasketballParseOverridesValue(options.overrides):mfBasketballReadOverrides(),knownIds=mfBasketballAllKnownDrillIds(overrideResult.store),addedInProposal=new Set();
  const rawSource=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const allowedTop=["schemaVersion","proposalVersion","proposalId","status","source","createdAt","updatedAt","summary","rationale","changes","validation","applyState","undoSnapshot"];
  Object.keys(rawSource).forEach(function(key){if(allowedTop.indexOf(key)===-1)errors.push("Proposal field "+key+" is unsupported.");});
  if(proposal.schemaVersion!==MF_BASKETBALL_PROPOSAL_SCHEMA_VERSION)errors.push("Basketball proposal schema is unsupported.");
  if(proposal.proposalVersion!==1)errors.push("Basketball proposal version is unsupported.");
  if(!/^bball-proposal-[a-z0-9][a-z0-9-]{2,79}$/i.test(proposal.proposalId))errors.push("Basketball proposal ID is missing or malformed.");
  if(["pending","applied","rejected","undone"].indexOf(proposal.status)===-1)errors.push("Basketball proposal status is unsupported.");
  if(!proposal.summary||proposal.summary.length>240)errors.push("Basketball proposal summary must be 1 to 240 characters.");
  if(proposal.rationale.length>2000)errors.push("Basketball proposal rationale must be 2000 characters or fewer.");
  if(!proposal.changes.length||proposal.changes.length>30)errors.push("Basketball proposal must contain 1 to 30 changes.");
  if(!mfBasketballIsIsoTimestamp(proposal.createdAt)||!mfBasketballIsIsoTimestamp(proposal.updatedAt))errors.push("Basketball proposal timestamps are malformed.");
  const prohibited=/history|historical|result|workout|habit|medication|recurring|profile|backup|timestamp|advance|completeSession|baseP/i;
  proposal.changes.forEach(function(change,index){
    if(!change||typeof change!=="object"||Array.isArray(change)){errors.push("Change "+(index+1)+" must be an object.");return;}
    const c=mfBasketballClone(change),action=String(c.action||"").toLowerCase();c.action=action;
    const allowedByAction={
      modify_drill:["action","programId","programVersion","sessionId","drillId","fields","rationale","expectedDrillFingerprint"],
      add_drill:["action","programId","programVersion","sessionId","drillId","drill","position","rationale","expectedSessionFingerprint","resultOrder"],
      remove_drill:["action","programId","programVersion","sessionId","drillId","rationale","expectedDrillFingerprint","expectedSessionFingerprint","resultOrder"],
      reorder_drills:["action","programId","programVersion","sessionId","order","rationale","expectedSessionFingerprint"],
      switch_program:["action","targetProgramId","targetProgramVersion","rationale","expectedActiveProgram"]
    }[action];
    if(!allowedByAction){errors.push("Change "+(index+1)+" uses unsupported action "+(action||"(missing)")+".");return;}
    Object.keys(c).forEach(function(key){if(allowedByAction.indexOf(key)===-1)errors.push("Change "+(index+1)+" field "+key+" is unsupported.");if(key!=="resultOrder"&&prohibited.test(key))errors.push("Change "+(index+1)+" contains a prohibited domain field.");});
    if(c.rationale!=null&&String(c.rationale).length>500)errors.push("Change "+(index+1)+" rationale must be 500 characters or fewer.");
    if(action==="switch_program"){
      const target=mfBasketballGetProgram(String(c.targetProgramId||""),c.targetProgramVersion);if(!target){errors.push("Program switch references an unknown built-in program/version.");return;}
      const state=options.programState&&options.programState.state?options.programState.state:options.programState||mfBasketballReadProgramState().state,expected=mfBasketballExpectedProgramState(state);
      mfBasketballCheckExpected(c,"expectedActiveProgram",expected,captureExpectedState,conflicts,"active_program");
      c.targetProgramId=target.id;c.targetProgramVersion=target.version;supported.push(c);return;
    }
    const program=mfBasketballGetProgram(String(c.programId||""),c.programVersion);if(!program){errors.push("Change "+(index+1)+" references an unknown basketball program/version.");return;}
    c.programId=program.id;c.programVersion=program.version;const session=mfBasketballProposalSession(working,program.id,program.version,String(c.sessionId||""),overrideResult);
    if(!session){errors.push("Change "+(index+1)+" references an unknown planned session.");return;}c.sessionId=session.id;
    const sessionFingerprint=mfBasketballFingerprint(session.drills.map(function(drill){return drill.id;}));
    if(action==="reorder_drills"){
      const order=Array.isArray(c.order)?c.order.map(String):null,ids=session.drills.map(function(item){return item.id;});
      mfBasketballCheckExpected(c,"expectedSessionFingerprint",sessionFingerprint,captureExpectedState,conflicts,session.id);
      if(!order||order.length!==ids.length||new Set(order).size!==order.length||order.some(function(id){return ids.indexOf(id)===-1;})){errors.push("Reorder-drills must list every resolved drill exactly once.");return;}
      const byId={};session.drills.forEach(function(item){byId[item.id]=item;});session.drills=order.map(function(id){return byId[id];});c.order=order;supported.push(c);return;
    }
    if(action==="add_drill"){
      const rawDrill=c.drill&&typeof c.drill==="object"?Object.assign({},c.drill,{id:c.drillId||c.drill.id}):{},validation=mfBasketballValidateDrillDefinition(rawDrill),position=Number(c.position);
      if(!validation.valid){errors.push.apply(errors,validation.errors.map(function(error){return "Change "+(index+1)+": "+error;}));return;}
      const id=validation.drill.id;if(knownIds.has(id)||addedInProposal.has(id)){if(!(proposal.status!=="pending"&&session.drills.some(function(drill){return drill.id===id;}))){errors.push("AI-added drill ID already exists: "+id+".");return;}}
      if(!Number.isInteger(position)||position<0||position>session.drills.length){errors.push("Add-drill position is invalid.");return;}
      mfBasketballCheckExpected(c,"expectedSessionFingerprint",sessionFingerprint,captureExpectedState,conflicts,session.id);
      c.drillId=id;c.drill=validation.drill;c.position=position;warnings.push.apply(warnings,validation.warnings);session.drills.splice(position,0,mfBasketballClone(validation.drill));knownIds.add(id);addedInProposal.add(id);c.resultOrder=session.drills.map(function(drill){return drill.id;});supported.push(c);return;
    }
    const drill=session.drills.find(function(item){return item.id===String(c.drillId||"");});if(!drill){errors.push("Change "+(index+1)+" references an unknown drill.");return;}c.drillId=drill.id;
    const drillFingerprint=mfBasketballFingerprint(drill);mfBasketballCheckExpected(c,"expectedDrillFingerprint",drillFingerprint,captureExpectedState,conflicts,drill.id);
    if(action==="modify_drill"){
      const fields=c.fields&&typeof c.fields==="object"&&!Array.isArray(c.fields)?c.fields:null;if(!fields){errors.push("Modify-drill fields must be an object.");return;}const safe={};Object.keys(fields).forEach(function(key){if(["name","target","confidence"].indexOf(key)===-1||prohibited.test(key))errors.push("Modify-drill field "+key+" is unsupported.");});
      if(fields.name!=null){const name=String(fields.name).trim();if(!name||name.length>120)errors.push("Modified drill name must be 1 to 120 characters.");else safe.name=name;}
      if(fields.confidence!=null){if(typeof fields.confidence!=="boolean")errors.push("Modified confidence flag must be true or false.");else safe.confidence=fields.confidence;}
      if(fields.target!=null){const target=mfBasketballValidateTarget(fields.target,drill.trackingMode,{priorTarget:drill.target});if(!target.valid)errors.push.apply(errors,target.errors);else safe.target=target.target;warnings.push.apply(warnings,target.warnings);}
      if(!Object.keys(safe).length){errors.push("Modify-drill change has no supported fields.");return;}c.fields=safe;Object.assign(drill,mfBasketballClone(safe));supported.push(c);return;
    }
    if(action==="remove_drill"){
      mfBasketballCheckExpected(c,"expectedSessionFingerprint",sessionFingerprint,captureExpectedState,conflicts,session.id);session.drills=session.drills.filter(function(item){return item.id!==drill.id;});if(!session.drills.length){errors.push("A planned session must retain at least one drill.");return;}c.resultOrder=session.drills.map(function(item){return item.id;});supported.push(c);return;
    }
  });
  if(conflicts.length)errors.push("Basketball program changed after this proposal was created. Review a fresh proposal.");
  proposal.changes=supported;proposal.validation={valid:errors.length===0,warnings:warnings.slice(),errors:errors.slice(),conflicts:[...new Set(conflicts)]};
  return {valid:errors.length===0,proposal:proposal,errors:errors,warnings:warnings,conflicts:[...new Set(conflicts)],supported:supported};
}

function mfBasketballGetProposal(){
  const raw=localStorage.getItem(MF_BASKETBALL_PROPOSAL_KEY);if(!raw)return null;try{return mfBasketballNormalizeProposal(JSON.parse(raw));}catch(e){return null;}
}

function mfBasketballImportProposal(raw,nowValue){
  const existing=mfBasketballGetProposal();if(existing&&existing.status==="pending")return {valid:false,errors:["A basketball proposal is already pending. Review or dismiss it before importing another."],warnings:[],conflicts:[]};
  const validation=mfBasketballValidateProposal(raw,{captureExpectedState:true});if(!validation.valid)return validation;const now=new Date(nowValue||new Date()).toISOString();validation.proposal.status="pending";validation.proposal.createdAt=validation.proposal.createdAt||now;validation.proposal.updatedAt=now;validation.proposal.validation={valid:true,warnings:validation.warnings,errors:[],conflicts:[]};localStorage.setItem(MF_BASKETBALL_PROPOSAL_KEY,JSON.stringify(validation.proposal));mfBasketballRenderProposalStatus();return validation;
}

function mfBasketballEnsureOverrideSession(store,programId,version,sessionId){
  if(!store.programs[programId])store.programs[programId]={baseVersion:version,sessions:{}};if(!store.programs[programId].sessions[sessionId])store.programs[programId].sessions[sessionId]={modified:{},added:{},disabled:{}};return store.programs[programId].sessions[sessionId];
}

function mfBasketballRestoreRaw(key,raw){raw==null?localStorage.removeItem(key):localStorage.setItem(key,raw);}

function mfBasketballApplyProposal(confirmApply,nowValue){
  const proposal=mfBasketballGetProposal();if(!proposal)return {applied:false,errors:["No basketball proposal exists."]};if(proposal.status!=="pending")return {applied:false,errors:["Only a pending basketball proposal can be applied."]};
  const validation=mfBasketballValidateProposal(proposal);if(!validation.valid)return {applied:false,errors:validation.errors,conflicts:validation.conflicts};
  const hasProgramChanges=validation.supported.some(function(change){return change.action!=="switch_program";}),hasSwitch=validation.supported.some(function(change){return change.action==="switch_program";}),expectedWrites=[MF_BASKETBALL_PROPOSAL_KEY];if(hasProgramChanges)expectedWrites.unshift(MF_BASKETBALL_OVERRIDES_KEY);if(hasSwitch)expectedWrites.splice(expectedWrites.length-1,0,MF_BASKETBALL_PROGRAM_STATE_KEY);
  if(confirmApply!==true)return {applied:false,requiresConfirmation:true,expectedWrites:expectedWrites,actions:validation.supported,warnings:validation.warnings};
  const beforeOverrides=localStorage.getItem(MF_BASKETBALL_OVERRIDES_KEY),beforeProgramState=localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY),sessionsBefore=localStorage.getItem(MF_BASKETBALL_STORAGE_KEY),next=mfBasketballClone(mfBasketballReadOverrides().store),now=new Date(nowValue||new Date()).toISOString(),applied=[];
  try{
    validation.supported.forEach(function(change){
      if(change.action==="switch_program"){const selected=mfBasketballSelectProgram(change.targetProgramId,now);if(!selected.ok)throw new Error(selected.error||"Program switch could not be saved.");applied.push({action:change.action,targetProgramId:change.targetProgramId});return;}
      const session=mfBasketballEnsureOverrideSession(next,change.programId,change.programVersion,change.sessionId);
      if(change.action==="modify_drill")session.modified[change.drillId]=Object.assign({},session.modified[change.drillId]||{},mfBasketballClone(change.fields),{source:"ai_proposal",proposalId:proposal.proposalId});
      if(change.action==="add_drill")session.added[change.drillId]=Object.assign({},mfBasketballClone(change.drill),{source:"ai_proposal",addedByProposalId:proposal.proposalId});
      if(change.action==="remove_drill")session.disabled[change.drillId]=true;
      if(change.action==="reorder_drills")session.order=change.order.slice();else if(change.resultOrder)session.order=change.resultOrder.slice();
      applied.push({action:change.action,programId:change.programId,sessionId:change.sessionId,drillId:change.drillId||null});
    });
    if(hasProgramChanges)mfBasketballWriteOverrides(next,now);
    if(localStorage.getItem(MF_BASKETBALL_STORAGE_KEY)!==sessionsBefore)throw new Error("Basketball history changed unexpectedly; apply was rolled back.");
    const appliedOverrides=localStorage.getItem(MF_BASKETBALL_OVERRIDES_KEY),appliedProgramState=localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY);proposal.status="applied";proposal.updatedAt=now;proposal.applyState={appliedAt:now,applied:applied,warnings:validation.warnings,expectedWrites:expectedWrites,appliedFingerprint:mfBasketballFingerprint({overrides:appliedOverrides,programState:appliedProgramState})};proposal.undoSnapshot={beforeOverridesRaw:beforeOverrides,beforeProgramStateRaw:beforeProgramState,appliedOverridesRaw:appliedOverrides,appliedProgramStateRaw:appliedProgramState,createdAt:now};localStorage.setItem(MF_BASKETBALL_PROPOSAL_KEY,JSON.stringify(proposal));
  }catch(e){mfBasketballRestoreRaw(MF_BASKETBALL_OVERRIDES_KEY,beforeOverrides);mfBasketballRestoreRaw(MF_BASKETBALL_PROGRAM_STATE_KEY,beforeProgramState);return {applied:false,errors:[e.message||"Basketball proposal apply failed and was rolled back."]};}
  mfBasketballRenderProgramSurface();mfBasketballRenderProposalStatus();return {applied:true,appliedChanges:applied,expectedWrites:expectedWrites,warnings:validation.warnings};
}

function mfBasketballUndoProposal(confirmUndo,nowValue){
  const proposal=mfBasketballGetProposal(),snapshot=proposal&&proposal.undoSnapshot;if(!proposal||proposal.status!=="applied"||!snapshot)return {undone:false,errors:["No valid basketball undo snapshot exists."]};
  if(localStorage.getItem(MF_BASKETBALL_OVERRIDES_KEY)!==snapshot.appliedOverridesRaw||localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY)!==snapshot.appliedProgramStateRaw)return {undone:false,conflict:true,errors:["Basketball settings changed after this proposal was applied; unsafe undo refused."]};
  if(confirmUndo!==true)return {undone:false,requiresConfirmation:true,expectedWrites:[MF_BASKETBALL_OVERRIDES_KEY,MF_BASKETBALL_PROGRAM_STATE_KEY,MF_BASKETBALL_PROPOSAL_KEY]};
  mfBasketballRestoreRaw(MF_BASKETBALL_OVERRIDES_KEY,snapshot.beforeOverridesRaw);mfBasketballRestoreRaw(MF_BASKETBALL_PROGRAM_STATE_KEY,snapshot.beforeProgramStateRaw);proposal.status="undone";proposal.updatedAt=new Date(nowValue||new Date()).toISOString();proposal.undoSnapshot=null;localStorage.setItem(MF_BASKETBALL_PROPOSAL_KEY,JSON.stringify(proposal));mfBasketballRenderProgramSurface();mfBasketballRenderProposalStatus();return {undone:true};
}

function mfBasketballRejectProposal(nowValue){
  const proposal=mfBasketballGetProposal();if(!proposal||proposal.status!=="pending")return false;proposal.status="rejected";proposal.updatedAt=new Date(nowValue||new Date()).toISOString();localStorage.setItem(MF_BASKETBALL_PROPOSAL_KEY,JSON.stringify(proposal));mfBasketballRenderProposalStatus();return true;
}

let mfBasketballEditingId = null;
let mfBasketballPendingDeleteId = null;
let mfBasketballSaving = false;
let mfBasketballPendingProgramAction = null;
let mfBasketballStructuredContext = null;
let mfBasketballStructuredIndex = 0;
let mfBasketballLastCompletion = null;

function mfBasketballDateKey(value){
  if(value instanceof Date && !isNaN(value.getTime())){
    const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,"0"),d=String(value.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+d;
  }
  return String(value||"").trim();
}

function mfBasketballIsValidDate(value){
  const text=String(value||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false;
  const parts=text.split("-").map(Number),date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  return date.getUTCFullYear()===parts[0]&&date.getUTCMonth()===parts[1]-1&&date.getUTCDate()===parts[2];
}

function mfBasketballIsIsoTimestamp(value){
  return typeof value==="string"&&value.trim()!==""&&!isNaN(Date.parse(value));
}

function mfBasketballCreateId(nowValue,randomValue){
  const now=Number(nowValue==null?Date.now():nowValue);
  let random=randomValue;
  if(random==null){
    if(typeof crypto!=="undefined"&&crypto&&typeof crypto.randomUUID==="function")random=crypto.randomUUID().replace(/-/g,"").slice(0,12);
    else random=Math.random().toString(36).slice(2,14);
  }
  return "bball-"+Math.max(0,Math.floor(now)).toString(36)+"-"+String(random).replace(/[^a-zA-Z0-9]/g,"").toLowerCase().slice(0,24);
}

function mfBasketballOptionalNumber(value,label,max,integer,errors){
  if(value==null||String(value).trim()==="")return null;
  const number=Number(value);
  if(!Number.isFinite(number)||number<0||number>max||(integer&&!Number.isInteger(number))){
    errors.push(label+" must be "+(integer?"a whole number":"a number")+" from 0 to "+max+".");
    return null;
  }
  return number;
}

function mfBasketballNormalizePair(input,madeKey,attemptedKey,label,errors){
  const nested=input&&input[label==="Shooting"?"shooting":"freeThrows"];
  const rawMade=input&&input[madeKey]!=null?input[madeKey]:nested&&nested.made;
  const rawAttempted=input&&input[attemptedKey]!=null?input[attemptedKey]:nested&&nested.attempted;
  const made=mfBasketballOptionalNumber(rawMade,label+" makes",MF_BASKETBALL_LIMITS.count,true,errors);
  const attempted=mfBasketballOptionalNumber(rawAttempted,label+" attempts",MF_BASKETBALL_LIMITS.count,true,errors);
  const hasMade=rawMade!=null&&String(rawMade).trim()!=="",hasAttempted=rawAttempted!=null&&String(rawAttempted).trim()!=="";
  if(hasMade!==hasAttempted)errors.push(label+" makes and attempts must both be supplied.");
  if(made!==null&&attempted!==null&&made>attempted){
    errors.push(label==="Shooting"?"Shooting makes cannot exceed attempts.":"Free throws made cannot exceed free throws attempted.");
  }
  return made!==null&&attempted!==null?{made:made,attempted:attempted}:null;
}

function mfBasketballSnapshotText(value,label,max,errors){
  const text=String(value||"").trim();
  if(!text||text.length>max)errors.push(label+" is missing or too long.");
  return text;
}

function mfBasketballNormalizePlannedTarget(value,mode,errors){
  if(value==null)return null;
  if(typeof value!=="object"||Array.isArray(value)){errors.push("Drill planned target is malformed.");return null;}
  const target={};
  function add(key,max,allowZero){
    if(value[key]==null)return;
    const number=Number(value[key]);
    if(!Number.isFinite(number)||number<0||(!allowZero&&number===0)||number>max){errors.push("Drill planned "+key+" is invalid.");return;}
    target[key]=number;
  }
  add("durationMinutes",MF_BASKETBALL_LIMITS.minutes,false);add("makes",MF_BASKETBALL_LIMITS.count,true);add("attempts",MF_BASKETBALL_LIMITS.count,false);add("minAttempts",MF_BASKETBALL_LIMITS.count,false);add("count",MF_BASKETBALL_LIMITS.count,true);
  if(mode==="makes_target"&&target.makes==null)errors.push("Makes-target drill is missing its planned makes snapshot.");
  if(mode==="benchmark_shooting"&&target.attempts==null)errors.push("Benchmark drill is missing its planned attempts snapshot.");
  return Object.keys(target).length?target:null;
}

function mfBasketballNormalizePrescription(value,errors){
  if(value==null)return null;
  if(typeof value!=="object"||Array.isArray(value)){errors.push("Drill prescription snapshot is malformed.");return null;}
  const keys=["doNow","workRest","success","setup","instructions","easier","harder","why"],out={};
  keys.forEach(function(key){const text=String(value[key]||"").trim();if(!text||text.length>MF_BASKETBALL_LIMITS.prescriptionText)errors.push("Drill prescription "+key+" is missing or too long.");else out[key]=text;});
  if(!Array.isArray(value.cues)||value.cues.length<1||value.cues.length>2)errors.push("Drill prescription must contain one or two cues.");
  else{out.cues=value.cues.map(function(cue){return String(cue||"").trim();});if(out.cues.some(function(cue){return !cue||cue.length>160;}))errors.push("Drill prescription cue is missing or too long.");}
  return out;
}

function mfBasketballOptionalActiveCalories(value,errors){
  if(!mfBasketballHasEnteredValue(value))return null;
  if(typeof value!=="number"&&(typeof value!=="string"||!/^\d+$/.test(value.trim()))){errors.push("Active calories must be a whole number from 0 to 5000.");return null;}
  const calories=Number(value);
  if(!Number.isFinite(calories)||!Number.isInteger(calories)||calories<0||calories>MF_BASKETBALL_LIMITS.activeCalories){errors.push("Active calories must be a whole number from 0 to 5000.");return null;}
  return calories;
}

function mfBasketballHasEnteredValue(value){
  return value!==null&&value!==undefined&&(typeof value==="boolean"||String(value).trim()!=="");
}

function mfBasketballDrillWasAttempted(input,trackingMode){
  input=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const source=input.actualResult&&typeof input.actualResult==="object"&&!Array.isArray(input.actualResult)?input.actualResult:{};
  if(String(input.notes||"").trim()||mfBasketballHasEnteredValue(input.confidence))return true;
  if(trackingMode==="confidence"||trackingMode==="duration")return mfBasketballHasEnteredValue(source.durationMinutes);
  if(trackingMode==="makes_target")return mfBasketballHasEnteredValue(source.makes);
  if(trackingMode==="benchmark_shooting")return mfBasketballHasEnteredValue(source.made)||mfBasketballHasEnteredValue(source.attempted);
  if(trackingMode==="count")return mfBasketballHasEnteredValue(source.count);
  if(trackingMode==="completion")return mfBasketballHasEnteredValue(source.completed);
  return false;
}

function mfBasketballNormalizeDrillResult(input,options,errors){
  options=options||{};input=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const drillId=String(input.drillId||"").trim(),trackingMode=String(input.trackingMode||"").trim();
  if(!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(drillId))errors.push("Drill ID is missing or malformed.");
  if(MF_BASKETBALL_TRACKING_MODES.indexOf(trackingMode)===-1)errors.push("Drill tracking mode is unsupported.");
  const nameSnapshot=mfBasketballSnapshotText(input.nameSnapshot,"Drill name snapshot",160,errors);
  const plannedTargetSnapshot=mfBasketballNormalizePlannedTarget(input.plannedTargetSnapshot,trackingMode,errors);
  const prescriptionSnapshot=mfBasketballNormalizePrescription(input.prescriptionSnapshot,errors);
  const notes=String(input.notes||"").trim();if(notes.length>MF_BASKETBALL_LIMITS.notes)errors.push("Drill notes must be 2000 characters or fewer.");
  const confidenceEntered=mfBasketballHasEnteredValue(input.confidence);
  let confidence=null;
  if(confidenceEntered){
    confidence=Number(input.confidence);if(!Number.isInteger(confidence)||confidence<1||confidence>10){errors.push("Confidence must be a whole number from 1 to 10.");confidence=null;}
  }
  const source=input.actualResult&&typeof input.actualResult==="object"&&!Array.isArray(input.actualResult)?input.actualResult:{};
  const result={drillId:drillId,nameSnapshot:nameSnapshot,trackingMode:trackingMode};
  if(plannedTargetSnapshot)result.plannedTargetSnapshot=plannedTargetSnapshot;
  if(prescriptionSnapshot)result.prescriptionSnapshot=prescriptionSnapshot;
  if(!mfBasketballDrillWasAttempted(input,trackingMode)){result.skipped=true;return result;}
  let actualResult=null;
  if(trackingMode==="confidence"){
    if(!confidenceEntered)errors.push("Confidence is required for confidence drills.");
    actualResult={};
    if(mfBasketballHasEnteredValue(source.durationMinutes)){
      const duration=Number(source.durationMinutes);if(!Number.isFinite(duration)||duration<0||duration>MF_BASKETBALL_LIMITS.minutes)errors.push("Actual drill duration is invalid.");else actualResult.durationMinutes=duration;
    }
  }else if(trackingMode==="duration"){
    if(!mfBasketballHasEnteredValue(source.durationMinutes))errors.push("Actual drill duration is required and must be valid.");else{const duration=Number(source.durationMinutes);if(!Number.isFinite(duration)||duration<0||duration>MF_BASKETBALL_LIMITS.minutes)errors.push("Actual drill duration is required and must be valid.");else actualResult={durationMinutes:duration};}
  }else if(trackingMode==="makes_target"){
    if(!mfBasketballHasEnteredValue(source.makes))errors.push("Makes completed must be a whole number from 0 to 10000.");else{const makes=Number(source.makes);if(!Number.isInteger(makes)||makes<0||makes>MF_BASKETBALL_LIMITS.count)errors.push("Makes completed must be a whole number from 0 to 10000.");else actualResult={makes:makes,targetAchieved:!!(plannedTargetSnapshot&&makes>=plannedTargetSnapshot.makes)};}
  }else if(trackingMode==="benchmark_shooting"){
    const madeEntered=mfBasketballHasEnteredValue(source.made),attemptedEntered=mfBasketballHasEnteredValue(source.attempted);
    if(!madeEntered||!attemptedEntered)errors.push("Benchmark made and attempted must both be supplied.");
    else{const made=Number(source.made),attempted=Number(source.attempted);if(!Number.isInteger(attempted)||attempted<=0||attempted>MF_BASKETBALL_LIMITS.count)errors.push("Benchmark attempts must be a whole number greater than 0.");if(!Number.isInteger(made)||made<0||made>MF_BASKETBALL_LIMITS.count)errors.push("Benchmark makes must be a whole number from 0 to 10000.");if(Number.isInteger(made)&&Number.isInteger(attempted)&&made>attempted)errors.push("Benchmark makes cannot exceed attempts.");if(Number.isInteger(made)&&Number.isInteger(attempted)&&attempted>0&&made<=attempted)actualResult={made:made,attempted:attempted,percentage:Math.round(made/attempted*1000)/10};}
  }else if(trackingMode==="count"){
    if(!mfBasketballHasEnteredValue(source.count))errors.push("Actual count must be a whole number from 0 to 10000.");else{const count=Number(source.count);if(!Number.isInteger(count)||count<0||count>MF_BASKETBALL_LIMITS.count)errors.push("Actual count must be a whole number from 0 to 10000.");else actualResult={count:count};}
  }else if(trackingMode==="completion"){
    if(typeof source.completed!=="boolean")errors.push("Completion drill must be marked completed or not completed.");else actualResult={completed:source.completed};
  }
  result.actualResult=actualResult;
  if(confidence!=null)result.confidence=confidence;
  if(notes)result.notes=notes;
  return result;
}

function mfBasketballNormalizeStructuredFields(input,errors){
  const hasStructured=input.programId!=null||input.plannedSessionId!=null||input.drills!=null;
  if(!hasStructured)return null;
  const programId=String(input.programId||"").trim(),programVersion=Number(input.programVersion),plannedSessionId=String(input.plannedSessionId||"").trim();
  if(!/^[a-z0-9][a-z0-9_]{2,79}$/.test(programId))errors.push("Basketball program ID is missing or malformed.");
  if(!Number.isInteger(programVersion)||programVersion<1)errors.push("Basketball program version is invalid.");
  if(!/^[a-z0-9][a-z0-9_]{2,79}$/.test(plannedSessionId))errors.push("Planned basketball session ID is missing or malformed.");
  const programNameSnapshot=mfBasketballSnapshotText(input.programNameSnapshot,"Program name snapshot",160,errors);
  const plannedSessionNameSnapshot=mfBasketballSnapshotText(input.plannedSessionNameSnapshot,"Planned session name snapshot",160,errors);
  if(!Array.isArray(input.drills)||!input.drills.length||input.drills.length>30)errors.push("Structured basketball session must contain 1 to 30 drill results.");
  const seen=new Set(),drills=Array.isArray(input.drills)?input.drills.slice(0,30).map(function(drill){const normalized=mfBasketballNormalizeDrillResult(drill,{},errors);if(seen.has(normalized.drillId))errors.push("Structured basketball session contains a duplicate drill ID.");seen.add(normalized.drillId);return normalized;}):[];
  if(drills.length&&!drills.some(function(drill){return !drill.skipped;}))errors.push("Record at least one drill result before finishing the structured basketball session.");
  return {programId:programId,programVersion:programVersion,programNameSnapshot:programNameSnapshot,plannedSessionId:plannedSessionId,plannedSessionNameSnapshot:plannedSessionNameSnapshot,drills:drills};
}

function mfBasketballNormalizeSession(input,options){
  options=options||{};
  input=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const errors=[];
  const date=mfBasketballDateKey(input.date);
  const type=String(input.type||"").trim();
  const minutes=Number(input.minutes);
  if(!mfBasketballIsValidDate(date))errors.push("Session date must be a valid date.");
  if(!Object.prototype.hasOwnProperty.call(MF_BASKETBALL_TYPES,type))errors.push("Session type is required.");
  if(!Number.isFinite(minutes)||minutes<=0||minutes>MF_BASKETBALL_LIMITS.minutes)errors.push("Total minutes must be greater than 0 and no more than 1440.");
  const dribblingMinutes=mfBasketballOptionalNumber(input.dribblingMinutes,"Dribbling minutes",MF_BASKETBALL_LIMITS.minutes,false,errors);
  if(dribblingMinutes!==null&&Number.isFinite(minutes)&&dribblingMinutes>minutes)errors.push("Dribbling minutes cannot exceed total minutes.");
  const shooting=mfBasketballNormalizePair(input,"shootingMade","shootingAttempted","Shooting",errors);
  const freeThrows=mfBasketballNormalizePair(input,"freeThrowsMade","freeThrowsAttempted","Free throws",errors);
  const notes=String(input.notes||"").trim();
  if(notes.length>MF_BASKETBALL_LIMITS.notes)errors.push("Notes must be 2000 characters or fewer.");
  const structured=mfBasketballNormalizeStructuredFields(input,errors);
  const activeCalories=structured?mfBasketballOptionalActiveCalories(input.activeCalories,errors):null;

  const stored=options.stored===true;
  const now=String(options.now||new Date().toISOString());
  let id=String(options.id||input.id||"").trim();
  if(!id&&!stored)id=mfBasketballCreateId();
  if(!/^bball-[A-Za-z0-9-]{3,80}$/.test(id))errors.push("Session ID is missing or malformed.");
  if(stored&&Number(input.schemaVersion)!==MF_BASKETBALL_SCHEMA_VERSION)errors.push("Session schemaVersion is unsupported.");
  let createdAt=String(options.createdAt||input.createdAt||now);
  let updatedAt=String(options.updatedAt||input.updatedAt||createdAt);
  if(stored&&(!mfBasketballIsIsoTimestamp(createdAt)||!mfBasketballIsIsoTimestamp(updatedAt)))errors.push("Session timestamps are missing or malformed.");
  if(!mfBasketballIsIsoTimestamp(createdAt))createdAt=now;
  if(!mfBasketballIsIsoTimestamp(updatedAt))updatedAt=now;

  if(errors.length)return {ok:false,errors:errors,session:null};
  const session={
    id:id,schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,date:date,type:type,minutes:minutes,
    createdAt:new Date(createdAt).toISOString(),updatedAt:new Date(updatedAt).toISOString()
  };
  if(dribblingMinutes!==null)session.dribblingMinutes=dribblingMinutes;
  if(shooting)session.shooting=shooting;
  if(freeThrows)session.freeThrows=freeThrows;
  if(notes)session.notes=notes;
  if(activeCalories!==null)session.activeCalories=activeCalories;
  if(structured)Object.assign(session,structured);
  return {ok:true,errors:[],session:session};
}

function mfBasketballParseStoreValue(raw){
  const result={schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,sessions:[],invalidRecordCount:0,duplicateIds:[],parseOk:true,error:null,keyExists:raw!=null};
  if(raw==null||raw==="")return result;
  let parsed;
  try{parsed=typeof raw==="string"?JSON.parse(raw):raw;}catch(e){result.parseOk=false;result.error="Basketball storage is not valid JSON.";return result;}
  const records=Array.isArray(parsed)?parsed:(parsed&&Number(parsed.schemaVersion)===MF_BASKETBALL_SCHEMA_VERSION&&Array.isArray(parsed.sessions)?parsed.sessions:null);
  if(!records){result.parseOk=false;result.error="Basketball storage schema is unsupported or malformed.";return result;}
  result.schemaVersion=Array.isArray(parsed)?MF_BASKETBALL_SCHEMA_VERSION:Number(parsed.schemaVersion);
  const seen=new Set();
  records.forEach(function(record){
    const normalized=mfBasketballNormalizeSession(record,{stored:true});
    if(!normalized.ok){result.invalidRecordCount++;return;}
    if(seen.has(normalized.session.id)){result.invalidRecordCount++;result.duplicateIds.push(normalized.session.id);return;}
    seen.add(normalized.session.id);result.sessions.push(normalized.session);
  });
  result.sessions.sort(function(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);});
  return result;
}

function mfBasketballReadStore(){
  let raw=null;
  try{raw=localStorage.getItem(MF_BASKETBALL_STORAGE_KEY);}catch(e){return {schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,sessions:[],invalidRecordCount:0,duplicateIds:[],parseOk:false,error:"Basketball storage could not be read.",keyExists:false};}
  return mfBasketballParseStoreValue(raw);
}

function mfBasketballWriteStore(sessions){
  const store={schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,sessions:sessions.slice().sort(function(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);})};
  localStorage.setItem(MF_BASKETBALL_STORAGE_KEY,JSON.stringify(store));
  return store;
}

function mfBasketballPreserveDormantFields(input,existing){
  const next=mfBasketballClone(input||{});if(!existing)return next;
  if(typeof p950IsTrackingEnabled==="function"&&!p950IsTrackingEnabled("modules.activeCalories")&&Object.prototype.hasOwnProperty.call(existing,"activeCalories"))next.activeCalories=existing.activeCalories;
  if(typeof p950IsTrackingEnabled==="function"&&!p950IsTrackingEnabled("modules.sessionNotes")){
    if(Object.prototype.hasOwnProperty.call(existing,"notes"))next.notes=existing.notes;
    const oldDrills={};(existing.drills||[]).forEach(function(drill){oldDrills[drill.drillId]=drill;});(next.drills||[]).forEach(function(drill){const old=oldDrills[drill.drillId];if(old&&Object.prototype.hasOwnProperty.call(old,"notes"))drill.notes=old.notes;else delete drill.notes;});
  }
  return next;
}

function mfBasketballSaveSession(input,options){
  options=options||{};
  const store=mfBasketballReadStore();
  if(!store.parseOk)return {ok:false,errors:[store.error||"Basketball storage is unavailable."],session:null};
  const existingId=String(options.existingId||"");
  const existing=existingId?store.sessions.find(function(session){return session.id===existingId;}):null;
  if(existingId&&!existing)return {ok:false,errors:["The basketball session being edited no longer exists."],session:null};
  input=mfBasketballPreserveDormantFields(input,existing);
  const now=String(options.now||new Date().toISOString());
  const normalized=mfBasketballNormalizeSession(input,{
    id:existing?existing.id:(options.id||""),
    createdAt:existing?existing.createdAt:now,
    updatedAt:now,
    now:now
  });
  if(!normalized.ok)return normalized;
  if(!existing&&store.sessions.some(function(session){return session.id===normalized.session.id;}))return {ok:false,errors:["A session with this ID already exists."],session:null};
  const sessions=existing?store.sessions.map(function(session){return session.id===existing.id?normalized.session:session;}):store.sessions.concat([normalized.session]);
  try{mfBasketballWriteStore(sessions);}catch(e){return {ok:false,errors:["Basketball session could not be saved."],session:null};}
  return {ok:true,errors:[],session:normalized.session};
}

function mfBasketballBuildStructuredInput(payload){
  payload=payload&&typeof payload==="object"?payload:{};
  const program=payload.existingId&&payload.programSnapshot?payload.programSnapshot:mfBasketballGetResolvedProgram(String(payload.programId||""),payload.programVersion),planned=payload.existingId&&payload.plannedSnapshot?payload.plannedSnapshot:program&&program.sessions.find(function(session){return session.id===payload.plannedSessionId;});
  if(!program||!planned)return {ok:false,errors:["The planned basketball session is unavailable."],input:null};
  const supplied=Array.isArray(payload.drills)?payload.drills:[],byId={};supplied.forEach(function(result){if(result&&result.drillId)byId[result.drillId]=result;});
  const drills=planned.drills.map(function(definition){
    const result=byId[definition.id]||{};
    return {drillId:definition.id,nameSnapshot:definition.name,trackingMode:definition.trackingMode,plannedTargetSnapshot:definition.target||null,prescriptionSnapshot:mfBasketballPrescriptionFor(definition),actualResult:result.actualResult||null,confidence:result.confidence,notes:result.notes};
  });
  const input={date:payload.date,type:"basketball_workout",minutes:payload.minutes,activeCalories:payload.activeCalories,notes:payload.notes,programId:program.id,programVersion:program.version,programNameSnapshot:program.name,plannedSessionId:planned.id,plannedSessionNameSnapshot:planned.name,drills:drills};
  const normalized=mfBasketballNormalizeSession(input,{id:payload.id||"",now:payload.now||new Date().toISOString()});
  return normalized.ok?{ok:true,errors:[],input:input}:{ok:false,errors:normalized.errors,input:null};
}

function mfBasketballFinishStructuredSession(payload,action){
  payload=payload&&typeof payload==="object"?payload:{};action=String(action||"");
  if(["advance","repeat","edit"].indexOf(action)===-1)return {ok:false,errors:["Choose Finish & Advance or Finish & Repeat Session."],session:null,advanced:false};
  const built=mfBasketballBuildStructuredInput(payload);if(!built.ok)return {ok:false,errors:built.errors,session:null,advanced:false};
  const isEdit=!!payload.existingId;
  if(action==="advance"&&!isEdit){
    const current=mfBasketballReadProgramState(),program=mfBasketballGetProgram(payload.programId,payload.programVersion),next=program&&program.sessions[current.state.nextSessionIndex];
    if(!current.parseOk||!program||current.state.activeProgramId!==program.id||current.state.activeProgramVersion!==program.version||!next||next.id!==payload.plannedSessionId)return {ok:false,errors:["Program progress changed. Reopen the current planned session before advancing."],session:null,advanced:false};
  }
  let priorSessions=null,priorProgram=null;
  try{priorSessions=localStorage.getItem(MF_BASKETBALL_STORAGE_KEY);priorProgram=localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY);}catch(e){}
  const saved=mfBasketballSaveSession(built.input,{existingId:payload.existingId||"",id:payload.id||"",now:payload.now});
  if(!saved.ok)return {ok:false,errors:saved.errors,session:null,advanced:false};
  if(action==="advance"&&!isEdit){
    const advanced=mfBasketballAdvanceProgramState(payload.now);
    if(!advanced.ok){
      try{if(priorSessions==null)localStorage.removeItem(MF_BASKETBALL_STORAGE_KEY);else localStorage.setItem(MF_BASKETBALL_STORAGE_KEY,priorSessions);if(priorProgram==null)localStorage.removeItem(MF_BASKETBALL_PROGRAM_STATE_KEY);else localStorage.setItem(MF_BASKETBALL_PROGRAM_STATE_KEY,priorProgram);}catch(e){}
      return {ok:false,errors:[advanced.error||"Program progress could not be saved."],session:null,advanced:false};
    }
    return {ok:true,errors:[],session:saved.session,advanced:true,programState:advanced.state};
  }
  return {ok:true,errors:[],session:saved.session,advanced:false,programState:mfBasketballReadProgramState().state};
}

function mfBasketballDeleteSession(id){
  const store=mfBasketballReadStore();
  if(!store.parseOk)return false;
  const next=store.sessions.filter(function(session){return session.id!==id;});
  if(next.length===store.sessions.length)return false;
  try{mfBasketballWriteStore(next);return true;}catch(e){return false;}
}

function mfBasketballAggregate(sessions){
  const list=Array.isArray(sessions)?sessions:[];
  const totals={totalSessions:list.length,totalMinutes:0,averageMinutes:0,structuredSessions:0,shooting:{made:0,attempted:0,percentage:null},freeThrows:{made:0,attempted:0,percentage:null},drillCounts:{},confidenceByDrill:{},benchmarksByDrill:{}};
  list.forEach(function(session){
    totals.totalMinutes+=Number(session.minutes)||0;
    if(Array.isArray(session.drills)){
      totals.structuredSessions++;
      session.drills.forEach(function(drill){
        if(drill.skipped)return;
        const identity=[session.programId,session.programVersion,session.plannedSessionId,drill.drillId,drill.trackingMode].join("|");totals.drillCounts[identity]=(totals.drillCounts[identity]||{id:drill.drillId,name:drill.nameSnapshot,count:0});totals.drillCounts[identity].count++;
        if(drill.confidence!=null){if(!totals.confidenceByDrill[identity])totals.confidenceByDrill[identity]={id:drill.drillId,name:drill.nameSnapshot,values:[]};totals.confidenceByDrill[identity].values.push({date:session.date,value:drill.confidence});}
        if(drill.trackingMode==="benchmark_shooting"&&drill.actualResult){if(!totals.benchmarksByDrill[identity])totals.benchmarksByDrill[identity]={id:drill.drillId,name:drill.nameSnapshot,values:[]};totals.benchmarksByDrill[identity].values.push({date:session.date,made:drill.actualResult.made,attempted:drill.actualResult.attempted,percentage:drill.actualResult.percentage});}
      });
    }
    if(session.shooting){totals.shooting.made+=session.shooting.made;totals.shooting.attempted+=session.shooting.attempted;}
    if(session.freeThrows){totals.freeThrows.made+=session.freeThrows.made;totals.freeThrows.attempted+=session.freeThrows.attempted;}
  });
  totals.averageMinutes=totals.totalSessions?totals.totalMinutes/totals.totalSessions:0;
  if(totals.shooting.attempted>0)totals.shooting.percentage=totals.shooting.made/totals.shooting.attempted*100;
  if(totals.freeThrows.attempted>0)totals.freeThrows.percentage=totals.freeThrows.made/totals.freeThrows.attempted*100;
  return totals;
}

function mfBasketballCollectActiveCalories(range,basketballSessions){
  range=range||{start:null,end:null};const lifting=[],basketball=[],workoutKeys=Object.keys(localStorage).filter(function(key){return /^day-\d{4}-\d{2}-\d{2}-wo$/.test(key);}),inRange=function(date){return (!range.start||date>=range.start)&&(!range.end||date<=range.end);};
  let liftingSupported=0;workoutKeys.forEach(function(key){const date=key.slice(4,-3);if(!inRange(date))return;let workout=null;try{workout=JSON.parse(localStorage.getItem(key)||"null");}catch(e){}if(!workout||!workout.exercises||!Object.keys(workout.exercises).length)return;liftingSupported++;const value=workout.activeCalories;if(Number.isInteger(value)&&value>=0&&value<=MF_BASKETBALL_LIMITS.activeCalories)lifting.push(value);});
  const supportedBasketball=(basketballSessions||[]).filter(function(session){return Array.isArray(session.drills)&&inRange(session.date);});supportedBasketball.forEach(function(session){if(Number.isInteger(session.activeCalories)&&session.activeCalories>=0&&session.activeCalories<=MF_BASKETBALL_LIMITS.activeCalories)basketball.push(session.activeCalories);});
  const liftingTotal=lifting.reduce(function(sum,value){return sum+value;},0),basketballTotal=basketball.reduce(function(sum,value){return sum+value;},0),total=liftingTotal+basketballTotal,recorded=lifting.length+basketball.length;
  return {total:total,average:recorded?total/recorded:null,recorded:recorded,supported:liftingSupported+supportedBasketball.length,liftingTotal:liftingTotal,liftingRecorded:lifting.length,basketballTotal:basketballTotal,basketballRecorded:basketball.length};
}

function mfBasketballFindDrillDefinition(drillId){
  for(let p=0;p<MF_BASKETBALL_PROGRAMS.length;p++){const program=mfBasketballGetResolvedProgram(MF_BASKETBALL_PROGRAMS[p].id,MF_BASKETBALL_PROGRAMS[p].version);for(let s=0;s<program.sessions.length;s++){
    const drill=program.sessions[s].drills.find(function(item){return item.id===drillId;});if(drill)return drill;
  }
  }
  return null;
}

function mfBasketballDrillHistory(drillId,sessions,identity){
  identity=identity||{};const exposures=[];(Array.isArray(sessions)?sessions:[]).forEach(function(session){
    if(identity.programId&&session.programId!==identity.programId)return;
    if(identity.programVersion!=null&&Number(session.programVersion)!==Number(identity.programVersion))return;
    if(identity.plannedSessionId&&session.plannedSessionId!==identity.plannedSessionId)return;
    (session.drills||[]).forEach(function(drill){if(drill.drillId===drillId&&!drill.skipped&&(!identity.trackingMode||drill.trackingMode===identity.trackingMode))exposures.push({date:session.date,createdAt:session.createdAt,sessionId:session.id,programId:session.programId,programVersion:session.programVersion,plannedSessionId:session.plannedSessionId,drill:drill});});
  });
  return exposures.sort(function(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.sessionId.localeCompare(b.sessionId);});
}

function mfBasketballProgressionResult(status,label,guidance,recent,extra){return Object.assign({status:status,label:label,guidance:guidance,ready:false,recent:recent||[]},extra||{});}

function mfBasketballConfidenceGuidance(recent,definition){
  const values=recent.map(function(item){return item.drill.confidence;}).filter(Number.isInteger).slice(0,3);
  if(!values.length)return mfBasketballProgressionResult("needs_more_evidence","NEEDS MORE EVIDENCE","Record confidence to establish a comparable result.",[]);
  if(values.length===1)return mfBasketballProgressionResult("first_result","FIRST RESULT","One confidence result is recorded; repeat before reading a trend.",values);
  if(values.length<3)return mfBasketballProgressionResult("building_consistency","BUILDING CONSISTENCY","Two comparable confidence results are recorded; one more helps confirm direction.",values);
  const chronological=values.slice().reverse(),range=Math.max.apply(null,values)-Math.min.apply(null,values),next=definition&&definition.progression;
  if(values.reduce(function(sum,value){return sum+value;},0)/values.length<4)return mfBasketballProgressionResult("needs_work","NEEDS WORK","Confidence remains low; repeat the foundation at the current difficulty.",values);
  if(chronological[0]<=chronological[1]&&chronological[1]<=chronological[2]&&chronological[2]-chronological[0]>=2)return mfBasketballProgressionResult("confidence_improved","CONFIDENCE IMPROVED","Confidence improved across three comparable results.",values);
  if(values.every(function(value){return value>=7;})&&range<=2)return mfBasketballProgressionResult("stable","HIGH CONFIDENCE — STABLE",next?"Quality is stable; review whether "+next.name+" is appropriate.":"Quality is stable; consider a small difficulty review.",values,{ready:true});
  if(range<=1)return mfBasketballProgressionResult("stable","STABLE","Confidence is consistent across three comparable results.",values);
  return mfBasketballProgressionResult("building_consistency","BUILDING CONSISTENCY","Confidence varies; keep the current drill and collect another result.",values);
}

function mfBasketballMakesTargetGuidance(recent,definition){
  const usable=recent.filter(function(item){return item.drill.actualResult&&Number.isFinite(item.drill.actualResult.makes)&&item.drill.plannedTargetSnapshot&&Number.isFinite(item.drill.plannedTargetSnapshot.makes);}).slice(0,3);
  if(!usable.length)return mfBasketballProgressionResult("needs_more_evidence","NEEDS MORE EVIDENCE","Record completed makes against the saved target.",[]);
  const values=usable.map(function(item){return item.drill.actualResult.makes;}),achieved=usable.map(function(item){return item.drill.actualResult.makes>=item.drill.plannedTargetSnapshot.makes;});
  if(usable.length===1)return mfBasketballProgressionResult(achieved[0]?"target_met":"first_result",achieved[0]?"TARGET MET":"FIRST RESULT",achieved[0]?"Target met once; repeat before changing it.":"One comparable result is recorded; repeat before reading a trend.",values);
  if(usable.length>=3&&achieved.every(Boolean)){const next=definition&&definition.progression;return mfBasketballProgressionResult("target_met","TARGET MET CONSISTENTLY",next?"Review whether "+next.name+" is the right next step.":"Review a modest target increase; do not change it automatically.",values,{ready:true});}
  const chronological=values.slice().reverse();if(usable.length>=3&&chronological[0]<chronological[1]&&chronological[1]<=chronological[2])return mfBasketballProgressionResult("improving","IMPROVING","Makes improved across three comparable results.",values);
  if(achieved[0])return mfBasketballProgressionResult("building_consistency","BUILDING CONSISTENCY","Latest target was met; repeat it before progressing.",values);
  if(usable.length>=3&&!achieved[0]&&!achieved[1])return mfBasketballProgressionResult("review_target","REVIEW TARGET","The last two comparable results missed the saved target; review difficulty or conditions.",values);
  return mfBasketballProgressionResult("building_consistency","BUILDING CONSISTENCY","Keep the current target while collecting another comparable result.",values);
}

function mfBasketballBenchmarkGuidance(recent){
  const usable=recent.filter(function(item){const result=item.drill.actualResult,target=item.drill.plannedTargetSnapshot||{};return result&&result.attempted>0&&result.attempted>=(target.minAttempts||10);}).slice(0,3);
  if(!usable.length)return mfBasketballProgressionResult("small_sample","NEEDS MORE EVIDENCE","Use at least the saved minimum attempts before comparing benchmarks.",[]);
  const values=usable.map(function(item){return item.drill.actualResult.percentage;});
  if(values.length===1)return mfBasketballProgressionResult("first_result","FIRST BENCHMARK","One meaningful benchmark is recorded; repeat before reading a trend.",values);
  const delta=Math.round((values[0]-values[1])*10)/10,attemptsMatch=usable[0].drill.actualResult.attempted===usable[1].drill.actualResult.attempted;
  if(delta>=3)return mfBasketballProgressionResult("improving","BENCHMARK IMPROVED","Latest percentage improved by "+delta.toFixed(1)+" points"+(attemptsMatch?" on the same attempts":"")+".",values,{trend:delta});
  if(delta<=-3)return mfBasketballProgressionResult("review_target","REVIEW BENCHMARK","Latest percentage was "+Math.abs(delta).toFixed(1)+" points lower; review conditions and repeat before changing the plan.",values,{trend:delta});
  return mfBasketballProgressionResult("stable","BENCHMARK STABLE","Latest percentage is within 2 points of the prior comparable result.",values,{trend:delta});
}

function mfBasketballDurationGuidance(recent,definition){
  const usable=recent.filter(function(item){return item.drill.actualResult&&Number.isFinite(item.drill.actualResult.durationMinutes)&&item.drill.plannedTargetSnapshot&&Number.isFinite(item.drill.plannedTargetSnapshot.durationMinutes);}).slice(0,3);
  if(!usable.length)return mfBasketballProgressionResult("needs_more_evidence","NEEDS MORE EVIDENCE","Record actual duration against the saved target.",[]);
  const values=usable.map(function(item){return item.drill.actualResult.durationMinutes;}),achieved=usable.map(function(item){return item.drill.actualResult.durationMinutes>=item.drill.plannedTargetSnapshot.durationMinutes;});
  if(usable.length===1)return mfBasketballProgressionResult(achieved[0]?"target_met":"first_result",achieved[0]?"DURATION MET":"FIRST RESULT",achieved[0]?"Planned duration met once; repeat before progressing.":"One comparable duration is recorded; repeat before reading a trend.",values);
  if(usable.length>=3&&achieved.every(Boolean)){const next=definition&&definition.progression;return mfBasketballProgressionResult("target_met","DURATION MET CONSISTENTLY",next?"Review whether "+next.name+" is appropriate.":"Review a small duration increase while preserving quality.",values,{ready:true});}
  if(values[0]>values[1]+.5)return mfBasketballProgressionResult("improving","DURATION IMPROVED","Latest comparable duration increased without changing metric type.",values);
  if(Math.abs(values[0]-values[1])<=.5)return mfBasketballProgressionResult("stable","DURATION STABLE","Latest two comparable durations are stable.",values);
  if(usable.length>=3&&!achieved[0]&&!achieved[1])return mfBasketballProgressionResult("review_target","REVIEW DURATION","The last two results were below the saved duration target.",values);
  return mfBasketballProgressionResult("building_consistency","BUILDING CONSISTENCY","Keep the current duration target and collect another result.",values);
}

function mfBasketballProgressionForDrill(drillId,sessions,definition,identity){
  definition=definition||mfBasketballFindDrillDefinition(drillId);identity=Object.assign({},identity||{});if(definition&&definition.trackingMode&&!identity.trackingMode)identity.trackingMode=definition.trackingMode;const recent=mfBasketballDrillHistory(drillId,sessions,identity);
  const mode=definition&&definition.trackingMode||(recent[0]&&recent[0].drill.trackingMode);
  let result;if(mode==="confidence")result=mfBasketballConfidenceGuidance(recent,definition);
  else if(mode==="makes_target")result=mfBasketballMakesTargetGuidance(recent,definition);
  else if(mode==="benchmark_shooting")result=mfBasketballBenchmarkGuidance(recent);
  else if(mode==="duration")result=mfBasketballDurationGuidance(recent,definition);
  else if(mode==="count"||mode==="completion")result=recent.length===0?mfBasketballProgressionResult("needs_more_evidence","NEEDS MORE EVIDENCE","Complete this drill to establish a result.",[]):recent.length===1?mfBasketballProgressionResult("first_result","FIRST RESULT","Repeat this drill before reading consistency.",recent.slice(0,3)):mfBasketballProgressionResult("building_consistency","BUILDING CONSISTENCY","Comparable exposures are accumulating; no cross-metric score is inferred.",recent.slice(0,3));
  else result=mfBasketballProgressionResult("needs_more_evidence","NEEDS MORE EVIDENCE","No compatible progression evidence is available.",[]);
  result.exposures=recent;return result;
}

function mfBasketballTypeLabel(type){return MF_BASKETBALL_TYPES[type]||"Basketball";}
function mfBasketballPercent(pair){return pair&&pair.attempted>0?Math.round(pair.made/pair.attempted*1000)/10:null;}
function mfBasketballFormatDate(date){return new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});}

function mfBasketballFormValue(id){const el=document.getElementById(id);return el?el.value:"";}
function mfBasketballSetFormValue(id,value){const el=document.getElementById(id);if(el)el.value=value==null?"":String(value);}
function mfBasketballSelectedAppDate(){return typeof tDate!=="undefined"?mfBasketballDateKey(tDate):mfBasketballDateKey(new Date());}

function mfBasketballElement(tag,className,textValue){
  const element=document.createElement(tag);if(className)element.className=className;if(textValue!=null)element.textContent=String(textValue);return element;
}
function mfBasketballSetIconLabel(element,name,label,className){if(typeof mfSetIconLabel==="function")mfSetIconLabel(element,name,label,className);else if(element)element.textContent=label;}

function mfBasketballChangeDescription(change){
  if(change.action==="switch_program"){
    const state=mfBasketballReadProgramState().state,from=mfBasketballGetProgram(state.activeProgramId,state.activeProgramVersion),to=mfBasketballGetProgram(change.targetProgramId,change.targetProgramVersion);
    return "Switch active basketball program from "+(from?from.name:"No active program")+" to "+(to?to.name:change.targetProgramId)+". The selected program will start at Session 1. Basketball history will be preserved.";
  }
  const program=mfBasketballGetResolvedProgram(change.programId,change.programVersion),session=program&&program.sessions.find(function(item){return item.id===change.sessionId;}),drill=session&&session.drills.find(function(item){return item.id===change.drillId;});
  if(change.action==="add_drill")return (change.drill&&change.drill.name||change.drillId)+" · "+mfBasketballDescribeTarget(change.drill||{})+" · Position "+(Number(change.position)+1)+" in "+(session?session.name:change.sessionId)+".";
  if(change.action==="remove_drill")return "Remove "+(drill?drill.name:change.drillId)+" from future planned sessions. Historical sessions remain unchanged.";
  if(change.action==="reorder_drills"){const names=(change.order||[]).map(function(id){const found=session&&session.drills.find(function(item){return item.id===id;});return found?found.name:id;});return "Set future order for "+(session?session.name:change.sessionId)+": "+names.join(" → ")+".";}
  if(change.action==="modify_drill"){
    const before=drill||{id:change.drillId,name:change.drillId,trackingMode:"completion"},after=Object.assign({},before,mfBasketballClone(change.fields||{})),parts=[];
    if(change.fields&&change.fields.name!=null)parts.push("Name: "+before.name+" → "+after.name);
    if(change.fields&&change.fields.target!=null)parts.push("Target: "+mfBasketballDescribeTarget(before)+" → "+mfBasketballDescribeTarget(after));
    if(change.fields&&change.fields.confidence!=null)parts.push("Confidence tracking: "+(before.confidence?"On":"Off")+" → "+(after.confidence?"On":"Off"));
    return before.name+"\n"+parts.join("\n");
  }
  return String(change.action||"Basketball change");
}

function mfBasketballLockProposalScroll(){
  const body=document.body;if(!body||!body.style||mfBasketballProposalScrollLock)return mfBasketballProposalScrollLock;
  const scrollX=Number(window.pageXOffset||window.scrollX||0),scrollY=Number(window.pageYOffset||window.scrollY||document.documentElement&&document.documentElement.scrollTop||0);
  mfBasketballProposalScrollLock={scrollX:scrollX,scrollY:scrollY,styles:{position:body.style.position||"",top:body.style.top||"",left:body.style.left||"",right:body.style.right||"",width:body.style.width||"",overflow:body.style.overflow||""}};
  body.style.position="fixed";body.style.top=(-scrollY)+"px";body.style.left="0";body.style.right="0";body.style.width="100%";body.style.overflow="hidden";if(body.classList)body.classList.add("mf-basketball-proposal-open");return mfBasketballProposalScrollLock;
}

function mfBasketballUnlockProposalScroll(){
  const body=document.body,lock=mfBasketballProposalScrollLock;if(body&&body.classList)body.classList.remove("mf-basketball-proposal-open");if(!lock||!body||!body.style){mfBasketballProposalScrollLock=null;return lock;}
  Object.keys(lock.styles).forEach(function(property){body.style[property]=lock.styles[property];});mfBasketballProposalScrollLock=null;return lock;
}

function mfBasketballCloseProposalReview(){
  const overlay=document.getElementById("mfBasketballProposalReview");if(overlay)overlay.classList.remove("open");const lock=mfBasketballUnlockProposalScroll(),returnFocus=mfBasketballProposalReturnFocus;mfBasketballProposalReturnFocus=null;
  if(returnFocus&&typeof returnFocus.focus==="function"&&returnFocus.isConnected!==false){try{returnFocus.focus({preventScroll:true});}catch(e){returnFocus.focus();}}
  if(lock&&typeof window.scrollTo==="function")window.scrollTo(lock.scrollX,lock.scrollY);
}

function mfBasketballRenderProposalStatus(){
  const roots=[document.getElementById("mfBasketballProposalStatus"),document.getElementById("mfBasketballToolsProposalStatus")].filter(Boolean),proposal=mfBasketballGetProposal();
  roots.forEach(function(root){root.replaceChildren();root.hidden=true;root.className="mf-basketball-proposal-status";if(!proposal)return;if(proposal.status==="pending"){root.hidden=false;root.appendChild(mfBasketballElement("strong","","Pending basketball proposal"));root.appendChild(document.createTextNode(" · "+proposal.summary));const review=mfBasketballElement("button","","REVIEW BASKETBALL PROPOSAL");review.type="button";review.addEventListener("click",mfBasketballOpenProposalReview);root.appendChild(review);}else if(proposal.status==="applied"&&proposal.undoSnapshot){root.hidden=false;root.className+=" applied";root.appendChild(mfBasketballElement("strong","","Basketball personalization applied"));root.appendChild(document.createTextNode(" · "+proposal.summary));const review=mfBasketballElement("button","","REVIEW / UNDO LAST APPLY");review.type="button";review.addEventListener("click",mfBasketballOpenProposalReview);root.appendChild(review);}});
}

function mfBasketballOpenProposalReview(){
  const proposal=mfBasketballGetProposal();if(!proposal)return false;let overlay=document.getElementById("mfBasketballProposalReview");if(!overlay){overlay=mfBasketballElement("div","p960-overlay mf-basketball-proposal-overlay");overlay.id="mfBasketballProposalReview";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-labelledby","mfBasketballProposalReviewTitle");overlay.addEventListener("click",function(event){if(event.target===overlay)mfBasketballCloseProposalReview();});document.body.appendChild(overlay);}const wasOpen=overlay.classList.contains("open");overlay.replaceChildren();
  const panel=mfBasketballElement("div","p960-panel"),head=mfBasketballElement("div","p960-head"),title=mfBasketballElement("h2","","Basketball Proposal Review"),close=mfBasketballElement("button","","Close / Review Later");title.id="mfBasketballProposalReviewTitle";close.type="button";close.addEventListener("click",mfBasketballCloseProposalReview);head.append(title,close);panel.appendChild(head);
  const summary=mfBasketballElement("p","mf-basketball-proposal-copy");summary.appendChild(mfBasketballElement("strong","",proposal.summary));panel.appendChild(summary);if(proposal.rationale)panel.appendChild(mfBasketballElement("p","mf-basketball-proposal-copy",proposal.rationale));
  let validation=null;if(proposal.status==="pending")validation=mfBasketballValidateProposal(proposal);
  const changes=validation&&validation.supported.length?validation.supported:proposal.changes;changes.forEach(function(change){const row=mfBasketballElement("div","p960-proposal-action"),badge=mfBasketballElement("span","p960-badge",String(change.action||"").replace(/_/g," ").toUpperCase()),technical=[change.programId&&"programId="+change.programId,change.sessionId&&"sessionId="+change.sessionId,change.drillId&&"drillId="+change.drillId,change.targetProgramId&&"targetProgramId="+change.targetProgramId].filter(Boolean).join(" · ");row.append(badge,document.createTextNode("\n"+mfBasketballChangeDescription(change)));if(technical)row.appendChild(mfBasketballElement("div","mf-basketball-proposal-technical",technical));panel.appendChild(row);});
  const warnings=validation?validation.warnings:(proposal.applyState&&proposal.applyState.warnings)||[];warnings.forEach(function(warning){panel.appendChild(mfBasketballElement("div","mf-basketball-proposal-warning",warning));});
  const message=mfBasketballElement("div","p960-msg");message.setAttribute("role","status");message.setAttribute("aria-live","polite");panel.appendChild(message);
  const footer=mfBasketballElement("div","p960-footer");
  if(proposal.status==="pending"){
    if(!validation.valid)message.className="mf-basketball-proposal-error",message.textContent=validation.errors.join("\n");
    else{const preview=mfBasketballApplyProposal(false);panel.appendChild(mfBasketballElement("p","mf-basketball-proposal-copy","Expected writes: "+preview.expectedWrites.join(", ")+". Basketball session history is never written."));}
    const keep=mfBasketballElement("button","","Keep Current Basketball Program");keep.type="button";keep.addEventListener("click",function(){mfBasketballRejectProposal();mfBasketballCloseProposalReview();});
    const apply=mfBasketballElement("button","p960-primary","Apply Supported Changes");apply.type="button";apply.disabled=!validation.valid;apply.addEventListener("click",function(){if(apply.dataset.confirm!=="true"){apply.dataset.confirm="true";apply.textContent="Confirm Apply";message.className="p960-msg";message.textContent="Confirm these future-program changes. Basketball history and logged results will remain untouched.";return;}const result=mfBasketballApplyProposal(true);if(!result.applied){message.className="mf-basketball-proposal-error";message.textContent=(result.errors||["Apply failed."]).join("\n");apply.dataset.confirm="false";apply.textContent="Apply Supported Changes";return;}mfBasketballCloseProposalReview();});footer.append(keep,apply);
  }else if(proposal.status==="applied"&&proposal.undoSnapshot){
    const undo=mfBasketballElement("button","p960-primary","Undo Last Basketball Apply");undo.type="button";undo.addEventListener("click",function(){if(undo.dataset.confirm!=="true"){const preview=mfBasketballUndoProposal(false);if(preview.conflict){message.className="mf-basketball-proposal-error";message.textContent=preview.errors.join("\n");return;}undo.dataset.confirm="true";undo.textContent="Confirm Undo";message.textContent="Restore the exact prior basketball personalization and program selection? History will remain untouched.";return;}const result=mfBasketballUndoProposal(true);if(!result.undone){message.className="mf-basketball-proposal-error";message.textContent=(result.errors||["Undo failed."]).join("\n");return;}mfBasketballCloseProposalReview();});footer.append(undo);
  }
  const footerClose=mfBasketballElement("button","","Close / Review Later");footerClose.type="button";footerClose.addEventListener("click",mfBasketballCloseProposalReview);footer.appendChild(footerClose);panel.appendChild(footer);overlay.appendChild(panel);if(!wasOpen){mfBasketballProposalReturnFocus=document.activeElement||null;mfBasketballLockProposalScroll();}overlay.classList.add("open");if(typeof close.focus==="function")close.focus();return true;
}

function mfBasketballDescribeTarget(drill){
  const target=drill.target||drill.plannedTargetSnapshot||{};
  if(drill.trackingMode==="confidence")return target.durationMinutes?target.durationMinutes+" planned minutes · Confidence 1–10":"Confidence 1–10";
  if(drill.trackingMode==="duration")return target.durationMinutes+" planned minutes"+(drill.confidence?" · Confidence optional":"");
  if(drill.trackingMode==="makes_target")return "Make "+target.makes+(drill.confidence?" · Quality confidence optional":"");
  if(drill.trackingMode==="benchmark_shooting")return target.attempts+" planned attempts";
  if(drill.trackingMode==="count")return "Target: "+target.count;
  return "Complete the block";
}

function mfBasketballBaseDrillDefinition(drillId){
  for(let p=0;p<MF_BASKETBALL_PROGRAMS.length;p++)for(let s=0;s<MF_BASKETBALL_PROGRAMS[p].sessions.length;s++){
    const drill=MF_BASKETBALL_PROGRAMS[p].sessions[s].drills.find(function(item){return item.id===drillId;});if(drill)return drill;
  }
  return null;
}

function mfBasketballTargetAwarePrescription(drill,standard){
  const target=drill.target||{},name=String(drill.name||"This drill"),prescription=mfBasketballClone(standard),mode=drill.trackingMode;
  if(mode==="makes_target"){
    const makes=target.makes;prescription.doNow="Complete "+makes+" made shots using the "+name+" setup and movement pattern.";prescription.workRest="Use manageable sets until "+makes+" makes are recorded; rest 20–45 sec between sets as needed.";prescription.success="Record every attempt and reach the displayed target of "+makes+" makes with the listed cues.";prescription.instructions="Use the setup below, repeat the prescribed movement, and count every make until "+makes+" is reached. Do not replace misses.";prescription.easier="Keep "+makes+" makes as the target, but use an easier distance or controlled pace while preserving the movement pattern.";prescription.harder="Keep "+makes+" makes as the target, but add distance, pace, or a movement entry while preserving the cues.";
  }else if(mode==="duration"||mode==="confidence"){
    const minutes=target.durationMinutes;if(!Number.isFinite(minutes)){prescription.doNow="Perform "+name+" using the listed setup and cues, then record an honest confidence score.";prescription.workRest="Use repeatable work rounds with brief recovery whenever technique needs to reset.";prescription.success="Complete the planned block with controlled technique and record the requested confidence result.";prescription.instructions="Use the setup below and repeat the prescribed movement for the planned block without inventing a numeric duration.";prescription.easier="Use controlled speed or shorter work rounds while preserving the movement pattern.";prescription.harder="Raise the pace or movement demand without changing the drill identity.";}else{prescription.doNow="Perform "+name+" for the displayed target of "+minutes+" total minutes using the listed setup and cues.";prescription.workRest="Accumulate "+minutes+" total minutes in repeatable work rounds with brief recovery as needed.";prescription.success="Complete the full "+minutes+"-minute target with controlled technique and the listed success standard.";prescription.instructions="Use the setup below and repeat the prescribed movement until "+minutes+" total minutes are complete; pause briefly when technique needs to reset.";prescription.easier="Keep the "+minutes+"-minute target, but shorten each work round or use controlled speed.";prescription.harder="Keep the "+minutes+"-minute target, but raise the pace or movement demand without changing the drill identity.";}
  }else if(mode==="count"){
    const count=target.count;prescription.doNow="Complete the displayed target of "+count+" clean repetitions using the "+name+" movement pattern.";prescription.workRest="Use manageable sets until "+count+" clean repetitions are recorded; rest briefly between sets.";prescription.success="Record "+count+" clean repetitions without counting restarts or incomplete reps.";prescription.instructions="Use the setup below, repeat the prescribed movement, and count only clean repetitions until "+count+" is reached.";prescription.easier="Keep "+count+" repetitions as the target, but simplify the approach or reduce movement speed.";prescription.harder="Keep "+count+" repetitions as the target, but add pace, distance, or the listed advanced movement demand.";
  }else if(mode==="benchmark_shooting"){
    const attempts=target.attempts,minAttempts=target.minAttempts;prescription.doNow="Take and record "+attempts+" "+name+" attempts, counting every make and miss.";prescription.workRest="Use repeatable small sets until "+attempts+" attempts are recorded; take a brief reset between sets.";prescription.success="Record every make and miss across "+attempts+" attempts"+(minAttempts?"; if interrupted, complete at least "+minAttempts+" attempts for usable evidence.":".");prescription.instructions="Use the setup below, keep locations and routine consistent, and stop after exactly "+attempts+" recorded attempts without replacing misses.";prescription.easier="Keep "+attempts+" attempts, but use an easier distance while preserving the same order and routine.";prescription.harder="Keep "+attempts+" attempts, but add the listed movement or fatigue demand without changing the recording method.";
  }
  return prescription;
}

function mfBasketballPrescriptionFor(drill){
  if(!drill)return null;
  if(drill.prescription)return drill.prescription;
  const standard=MF_BASKETBALL_PRESCRIPTIONS[drill.id];if(!standard)return null;
  const base=mfBasketballBaseDrillDefinition(drill.id);if(!base||mfBasketballFingerprint(base.target||null)===mfBasketballFingerprint(drill.target||null))return standard;
  return mfBasketballTargetAwarePrescription(drill,standard);
}

function mfBasketballExportPrescription(prescription,label){
  if(!prescription)return "";const clean=function(value,max){const text=String(value||"").replace(/\s+/g," ").trim();return text.length>max?text.slice(0,max-1).trim()+"…":text;};
  return label+" — Do now: "+clean(prescription.doNow,220)+" | Work/rest: "+clean(prescription.workRest,180)+" | Cues: "+prescription.cues.slice(0,2).map(function(cue){return clean(cue,100);}).join("; ")+" | Success: "+clean(prescription.success,200);
}

function mfBasketballAppendPrescriptionDetails(parent,prescription){
  if(!parent||!prescription)return;
  const details=mfBasketballElement("details","mf-basketball-howto"),summary=mfBasketballElement("summary","","How to do it"),body=mfBasketballElement("div","mf-basketball-howto-body");
  body.id="mfBasketballHowtoBody"+(++mfBasketballHowtoCounter);summary.setAttribute("aria-controls",body.id);summary.setAttribute("aria-expanded","false");details.addEventListener("toggle",function(){summary.setAttribute("aria-expanded",String(details.open));});summary.addEventListener("keydown",function(event){if(event.key!==" "&&event.key!=="Enter")return;event.preventDefault();details.open=!details.open;});
  [["Setup",prescription.setup],["Full instructions",prescription.instructions],["Easier",prescription.easier],["Harder",prescription.harder],["Why it is scheduled",prescription.why]].forEach(function(row){const block=mfBasketballElement("div","mf-basketball-howto-row");block.append(mfBasketballElement("strong","",row[0]),mfBasketballElement("span","",row[1]));body.appendChild(block);});details.append(summary,body);parent.appendChild(details);
}

function mfBasketballTrackingLabel(mode){return {confidence:"Confidence",duration:"Duration",makes_target:"Makes target",benchmark_shooting:"Shooting benchmark",count:"Repetition count",completion:"Completion"}[mode]||"Recorded result";}

function mfBasketballSessionPlannedMinutes(session){
  const drills=session&&Array.isArray(session.drills)?session.drills:[],minutes=drills.reduce(function(sum,drill){return sum+Number(drill.target&&drill.target.durationMinutes||0);},0),unknown=drills.some(function(drill){return !(drill.target&&drill.target.durationMinutes);});
  return minutes?{minutes:minutes,label:(unknown?minutes+"+":""+minutes)+" planned min",partial:unknown}:null;
}

function mfBasketballIdentity(program,session,drill){return {programId:program&&program.id,programVersion:program&&program.version,plannedSessionId:session&&session.id,trackingMode:drill&&drill.trackingMode};}

function mfBasketballLastResultText(progression,mode){
  if(!progression||!progression.exposures||!progression.exposures.length)return "No comparable result yet";
  return mfBasketballDrillResultText(progression.exposures[0].drill)+(mode==="confidence"&&progression.exposures[0].drill.confidence!=null?" · Confidence "+progression.exposures[0].drill.confidence+"/10":"");
}

function mfBasketballPersonalizationLabel(programId,sessionId,drillId){
  const parsed=mfBasketballReadOverrides(),program=parsed.store.programs[programId],session=program&&program.sessions[sessionId];if(!session)return "";
  if(session.added&&session.added[drillId])return "Added";if(session.modified&&session.modified[drillId])return "Modified";return "";
}

function mfBasketballRenderProgramView(program,nextIndex){
  const root=document.getElementById("mfBasketballProgramView");if(!root)return;root.replaceChildren();if(!program)return;
  root.appendChild(mfBasketballElement("div","mf-basketball-program-view-title","PERSONALIZED CURRENT PROGRAM"));
  const overrides=mfBasketballReadOverrides().store,programOverrides=overrides.programs[program.id];if(!programOverrides)root.appendChild(mfBasketballElement("div","mf-basketball-program-view-note","Base program · No personalization applied"));
  program.sessions.forEach(function(session,index){
    const details=mfBasketballElement("details","mf-basketball-program-session"),summary=mfBasketballElement("summary"),title=mfBasketballElement("span","",session.name),meta=mfBasketballElement("span","",(index===nextIndex?"Next · ":"")+session.drills.length+" drills");summary.append(title,meta);details.appendChild(summary);
    const focus=mfBasketballElement("div","mf-basketball-program-session-focus",session.focus);details.appendChild(focus);
    session.drills.forEach(function(drill){const row=mfBasketballElement("div","mf-basketball-program-drill"),text=mfBasketballElement("div"),name=mfBasketballElement("strong","",drill.name),target=mfBasketballElement("span","",mfBasketballDescribeTarget(drill)+" · "+mfBasketballTrackingLabel(drill.trackingMode)),prescription=mfBasketballPrescriptionFor(drill),badgeText=mfBasketballPersonalizationLabel(program.id,session.id,drill.id);text.append(name,target);if(prescription)text.append(mfBasketballElement("span","mf-basketball-program-do",prescription.doNow),mfBasketballElement("small","","Why: "+prescription.why));row.appendChild(text);if(badgeText)row.appendChild(mfBasketballElement("span","mf-basketball-personalized-badge",badgeText));details.appendChild(row);});
    const overlay=programOverrides&&programOverrides.sessions[session.id];Object.keys(overlay&&overlay.disabled||{}).forEach(function(drillId){const base=mfBasketballGetProgram(program.id,program.version),baseSession=base&&base.sessions.find(function(item){return item.id===session.id;}),drill=baseSession&&baseSession.drills.find(function(item){return item.id===drillId;});if(!drill)return;const row=mfBasketballElement("div","mf-basketball-program-drill disabled"),text=mfBasketballElement("div");text.append(mfBasketballElement("strong","",drill.name),mfBasketballElement("span","","Disabled for future sessions · historical results preserved"));row.append(text,mfBasketballElement("span","mf-basketball-personalized-badge","Disabled"));details.appendChild(row);});
    root.appendChild(details);
  });
}

function mfBasketballShowStructuredMessage(message,type){
  const element=document.getElementById("mfBasketballStructuredMessage");if(!element)return;element.textContent=message||"";element.className="mf-basketball-message"+(message?" "+(type||"ok"):"");
}

function mfBasketballRenderProgramSurface(){
  const select=document.getElementById("mfBasketballProgramSelect"),status=document.getElementById("mfBasketballProgramStatus"),summary=document.getElementById("mfBasketballProgramSummary"),nextRoot=document.getElementById("mfBasketballNextSession"),actions=document.getElementById("mfBasketballProgramActions");
  mfBasketballRenderProposalStatus();
  if(!select||!status||!summary||!nextRoot)return;
  const prior=select.value;select.replaceChildren();const empty=mfBasketballElement("option","","Select a program");empty.value="";select.appendChild(empty);
  MF_BASKETBALL_PROGRAMS.forEach(function(program){const option=mfBasketballElement("option","",program.name);option.value=program.id;select.appendChild(option);});
  const stored=mfBasketballReadProgramState(),program=mfBasketballGetResolvedProgram(stored.state.activeProgramId,stored.state.activeProgramVersion);
  select.value=program?program.id:(prior&&mfBasketballGetProgram(prior)?prior:"");summary.replaceChildren();nextRoot.replaceChildren();
  if(!stored.parseOk){status.textContent="Program state is unavailable. Restore a valid backup or choose a program to replace it.";status.className="mf-basketball-program-status error";if(actions)actions.hidden=true;return;}
  if(!program){status.textContent="No structured program selected. Free-form logging remains available.";status.className="mf-basketball-program-status";summary.textContent="Choose a flexible session queue. Training advances only when you finish and explicitly choose Advance.";if(actions)actions.hidden=true;return;}
  const planned=program.sessions[stored.state.nextSessionIndex],duration=mfBasketballSessionPlannedMinutes(planned);status.textContent=program.name;status.className="mf-basketball-program-status active";
  const description=mfBasketballElement("div","mf-basketball-program-description",program.description);const position=mfBasketballElement("div","mf-basketball-program-position","Active program · Session "+(stored.state.nextSessionIndex+1)+" of "+program.sessions.length+" is next because the queue advances only after Finish & Advance");summary.append(description,position);
  const kicker=mfBasketballElement("div","mf-basketball-next-kicker","NEXT SESSION"),title=mfBasketballElement("div","mf-basketball-next-title",planned.name),meta=mfBasketballElement("div","mf-basketball-next-meta"),focus=mfBasketballElement("div","mf-basketball-next-focus",planned.focus),list=mfBasketballElement("ol","mf-basketball-next-drills");
  meta.append(mfBasketballElement("span","","Session "+(stored.state.nextSessionIndex+1)+" of "+program.sessions.length),mfBasketballElement("span","",planned.drills.length+" drills"));if(duration)meta.appendChild(mfBasketballElement("span","",duration.label));
  const sessions=mfBasketballReadStore().sessions;planned.drills.forEach(function(drill){const item=mfBasketballElement("li"),name=mfBasketballElement("strong","mf-basketball-next-drill-name",drill.name),target=mfBasketballElement("span","",mfBasketballDescribeTarget(drill)),prescription=mfBasketballPrescriptionFor(drill),progression=mfBasketballProgressionForDrill(drill.id,sessions,drill,mfBasketballIdentity(program,planned,drill));item.append(name);if(prescription)item.append(mfBasketballElement("span","mf-basketball-next-do",prescription.doNow),target,mfBasketballElement("small","","Variation: Standard · Why: "+prescription.why));else item.append(target);item.append(mfBasketballElement("small","","Last: "+mfBasketballLastResultText(progression,drill.trackingMode)));list.appendChild(item);});
  const start=mfBasketballElement("button","mf-basketball-start","START SESSION");start.type="button";start.id="mfBasketballStartPlanned";start.setAttribute("aria-label","START PLANNED SESSION");start.addEventListener("click",mfBasketballStartPlannedSession);nextRoot.append(kicker,title,meta,focus,list,start);mfBasketballRenderProgramView(program,stored.state.nextSessionIndex);if(actions)actions.hidden=false;
}

function mfBasketballCreateNumberField(labelText,field,min,max,step,value){
  const label=mfBasketballElement("label","mf-basketball-field",labelText),input=mfBasketballElement("input");input.type="number";input.inputMode=step&&step!==1?"decimal":"numeric";input.min=String(min);input.max=String(max);input.step=String(step||1);input.dataset.field=field;if(value!=null)input.value=String(value);label.appendChild(input);return label;
}

function mfBasketballAddConfidenceControl(card,value){
  const group=mfBasketballElement("fieldset","mf-basketball-confidence"),legend=mfBasketballElement("legend","","Confidence: 1–10"),display=mfBasketballElement("span","mf-basketball-confidence-value",value?value+" / 10":"Not scored"),input=mfBasketballElement("input");input.type="hidden";input.dataset.field="confidence";input.value=value==null?"":String(value);group.append(legend,display,input);
  const buttons=mfBasketballElement("div","mf-basketball-confidence-buttons");
  for(let score=1;score<=10;score++){
    const button=mfBasketballElement("button","mf-basketball-confidence-button",score);button.type="button";button.dataset.score=String(score);button.setAttribute("aria-label","Confidence "+score+" out of 10");button.setAttribute("aria-pressed",String(Number(value)===score));
    button.addEventListener("click",function(){input.value=String(score);display.textContent=score+" / 10";buttons.querySelectorAll("button").forEach(function(item){item.setAttribute("aria-pressed",String(item===button));});mfBasketballUpdateStructuredSummary();});buttons.appendChild(button);
  }
  group.appendChild(buttons);card.appendChild(group);
}

function mfBasketballRenderDrillCard(definition,index,existing){
  existing=existing||{};const card=mfBasketballElement("article","mf-basketball-drill-card");card.dataset.drillId=definition.id;card.dataset.trackingMode=definition.trackingMode;
  const total=mfBasketballStructuredContext&&mfBasketballStructuredContext.planned.drills.length||index+1,head=mfBasketballElement("div","mf-basketball-drill-head"),number=mfBasketballElement("span","mf-basketball-drill-number",index+1),text=mfBasketballElement("div"),position=mfBasketballElement("div","mf-basketball-drill-position","DRILL "+(index+1)+" OF "+total),name=mfBasketballElement("div","mf-basketball-drill-name",definition.name),plan=mfBasketballElement("div","mf-basketball-drill-plan",mfBasketballDescribeTarget(definition));text.append(position,name,plan);head.append(number,text);card.appendChild(head);
  const prescription=mfBasketballPrescriptionFor(definition);if(prescription){const now=mfBasketballElement("section","mf-basketball-do-now"),label=mfBasketballElement("div","mf-basketball-do-now-label","DO THIS NOW"),action=mfBasketballElement("div","mf-basketball-do-now-action",prescription.doNow),structure=mfBasketballElement("div","mf-basketball-do-now-structure",prescription.workRest),cues=mfBasketballElement("div","mf-basketball-do-now-cues","Cues: "+prescription.cues.join(" · ")),success=mfBasketballElement("div","mf-basketball-do-now-success","Success: "+prescription.success);now.append(label,action,structure,cues,success);card.appendChild(now);mfBasketballAppendPrescriptionDetails(card,prescription);}
  const context=mfBasketballStructuredContext,identity=context?{programId:context.programId,programVersion:context.programVersion,plannedSessionId:context.plannedSessionId,trackingMode:definition.trackingMode}:{trackingMode:definition.trackingMode},prior=mfBasketballProgressionForDrill(definition.id,mfBasketballReadStore().sessions,definition,identity),last=mfBasketballElement("div","mf-basketball-last-trend");last.append(mfBasketballElement("span","","Last: "+mfBasketballLastResultText(prior,definition.trackingMode)),mfBasketballElement("strong","",prior.label));card.appendChild(last);if(prior.status!=="needs_more_evidence"&&prior.status!=="small_sample"){const guidance=mfBasketballElement("div","mf-basketball-guidance "+prior.status,prior.guidance);card.appendChild(guidance);}
  const result=existing.actualResult||{},target=definition.target||{};
  if(definition.trackingMode==="confidence"){
    if(target.durationMinutes!=null)card.appendChild(mfBasketballCreateNumberField("Actual minutes (optional)","durationMinutes",0,1440,.5,result.durationMinutes));
    mfBasketballAddConfidenceControl(card,existing.confidence);
  }else if(definition.trackingMode==="duration"){
    card.appendChild(mfBasketballCreateNumberField("Actual minutes","durationMinutes",0,1440,.5,result.durationMinutes));if(definition.confidence)mfBasketballAddConfidenceControl(card,existing.confidence);
  }else if(definition.trackingMode==="makes_target"){
    card.appendChild(mfBasketballCreateNumberField("Makes completed","makes",0,10000,1,result.makes));if(definition.confidence)mfBasketballAddConfidenceControl(card,existing.confidence);
  }else if(definition.trackingMode==="benchmark_shooting"){
    const grid=mfBasketballElement("div","mf-basketball-benchmark-grid");grid.append(mfBasketballCreateNumberField("Made","made",0,10000,1,result.made),mfBasketballCreateNumberField("Attempted","attempted",1,10000,1,result.attempted));card.appendChild(grid);const percent=mfBasketballElement("div","mf-basketball-benchmark-percent",result.attempted?"Percentage: "+(Math.round(result.made/result.attempted*1000)/10)+"%":"Percentage: —");percent.dataset.role="percentage";card.appendChild(percent);
  }else if(definition.trackingMode==="count"){
    card.appendChild(mfBasketballCreateNumberField("Completed count","count",0,10000,1,result.count));if(definition.confidence)mfBasketballAddConfidenceControl(card,existing.confidence);
  }else{
    const label=mfBasketballElement("label","mf-basketball-field mf-basketball-completion-field","Result"),select=mfBasketballElement("select");select.dataset.field="completed";[["","Skipped / no result"],["true","Completed"],["false","Not completed"]].forEach(function(optionData){const option=mfBasketballElement("option","",optionData[1]);option.value=optionData[0];select.appendChild(option);});select.value=result.completed===true?"true":result.completed===false?"false":"";label.appendChild(select);card.appendChild(label);
  }
  const notesDetails=mfBasketballElement("details","mf-basketball-drill-notes"),notesSummary=mfBasketballElement("summary","","Add drill note"),notes=mfBasketballElement("textarea");notes.rows=2;notes.maxLength=2000;notes.placeholder="Optional note";notes.dataset.field="notes";notes.value=existing.notes||"";notesDetails.append(notesSummary,notes);if(existing.notes)notesDetails.open=true;card.appendChild(notesDetails);
  const nav=mfBasketballElement("div","mf-basketball-drill-nav"),previous=mfBasketballElement("button","mf-basketball-drill-previous","PREVIOUS"),skip=mfBasketballElement("button","mf-basketball-drill-skip","SKIP — NEUTRAL"),next=mfBasketballElement("button","mf-basketball-drill-next",index===total-1?"REVIEW SESSION":"COMPLETE & NEXT");previous.type=skip.type=next.type="button";previous.disabled=index===0;previous.addEventListener("click",function(){mfBasketballShowStructuredDrill(index-1);});skip.addEventListener("click",function(){card.querySelectorAll("input, textarea, select").forEach(function(input){if(input.type!=="button")input.value="";});mfBasketballUpdateStructuredSummary();mfBasketballShowStructuredDrill(Math.min(total,index+1));});next.addEventListener("click",function(){mfBasketballShowStructuredDrill(Math.min(total,index+1));});nav.append(previous,skip,next);card.appendChild(nav);
  card.addEventListener("input",mfBasketballUpdateStructuredSummary);card.addEventListener("change",mfBasketballUpdateStructuredSummary);return card;
}

function mfBasketballDismissKeyboard(){const active=document.activeElement;if(active&&typeof active.blur==="function")active.blur();}

function mfBasketballShowStructuredDrill(index){
  if(!mfBasketballStructuredContext)return;const logger=document.getElementById("mfBasketballDrillLogger"),cards=Array.from(logger?logger.querySelectorAll(".mf-basketball-drill-card"):[]),summary=document.getElementById("mfBasketballSessionSummary"),progress=document.getElementById("mfBasketballCourtsideProgress"),finish=document.getElementById("mfBasketballFinishActions");mfBasketballDismissKeyboard();
  if(index>=cards.length){cards.forEach(function(card){card.hidden=true;});mfBasketballStructuredIndex=cards.length;if(progress)progress.textContent="Session review · Check results before finishing";if(finish)finish.hidden=false;if(summary){summary.hidden=false;summary.scrollIntoView({behavior:"smooth",block:"start"});}return;}
  mfBasketballStructuredIndex=Math.max(0,index);cards.forEach(function(card,cardIndex){card.hidden=cardIndex!==mfBasketballStructuredIndex;});if(summary)summary.hidden=true;if(finish)finish.hidden=true;if(progress)progress.textContent="Drill "+(mfBasketballStructuredIndex+1)+" of "+cards.length+" · Results save only when you finish the session";const current=cards[mfBasketballStructuredIndex];if(current){current.scrollIntoView({behavior:"smooth",block:"start"});const first=current.querySelector("input:not([type='hidden']), select, button.mf-basketball-confidence-button");if(first&&typeof first.focus==="function")first.focus();}
}

function mfBasketballOpenStructuredLogger(program,planned,existing){
  const root=document.getElementById("mfBasketballStructuredLogger"),drillsRoot=document.getElementById("mfBasketballDrillLogger");if(!root||!drillsRoot)return;
  mfBasketballStructuredContext={programId:program.id,programVersion:program.version,plannedSessionId:planned.id,existingId:existing&&existing.id||"",planned:planned};
  document.getElementById("mfBasketballStructuredProgram").textContent=program.name;document.getElementById("mfBasketballStructuredTitle").textContent=planned.name;
  mfBasketballSetFormValue("mfBasketballStructuredDate",existing&&existing.date||mfBasketballSelectedAppDate());mfBasketballSetFormValue("mfBasketballStructuredMinutes",existing&&existing.minutes||"");mfBasketballSetFormValue("mfBasketballStructuredActiveCalories",existing&&existing.activeCalories!=null?existing.activeCalories:"");mfBasketballSetFormValue("mfBasketballStructuredNotes",existing&&existing.notes||"");
  drillsRoot.replaceChildren();const existingById={};((existing&&existing.drills)||[]).forEach(function(drill){existingById[drill.drillId]=drill;});planned.drills.forEach(function(drill,index){drillsRoot.appendChild(mfBasketballRenderDrillCard(drill,index,existingById[drill.id]));});
  const advance=document.getElementById("mfBasketballFinishAdvance"),repeat=document.getElementById("mfBasketballFinishRepeat");if(advance)advance.hidden=!!existing;if(repeat)repeat.textContent=existing?"SAVE SESSION CHANGES":"FINISH & REPEAT SESSION";
  root.hidden=false;if(document.body&&document.body.classList)document.body.classList.add("mf-basketball-structured-open");mfBasketballShowStructuredMessage("");mfBasketballUpdateStructuredSummary();mfBasketballShowStructuredDrill(0);if(typeof p950ApplyTrackingPreferencesToUi==="function")p950ApplyTrackingPreferencesToUi();
}

function mfBasketballStartPlannedSession(){
  const state=mfBasketballReadProgramState(),program=mfBasketballGetResolvedProgram(state.state.activeProgramId,state.state.activeProgramVersion),planned=program&&program.sessions[state.state.nextSessionIndex];if(!state.parseOk||!program||!planned){mfBasketballShowMessage(state.error||"Choose a basketball program first.","error");return;}mfBasketballOpenStructuredLogger(program,planned,null);
}

function mfBasketballStartStructuredEdit(session){
  const base=mfBasketballGetProgram(session.programId,session.programVersion);if(!base){mfBasketballShowMessage("This historical program version can be viewed but is not editable in the current templates.","error");return;}const program={id:session.programId,version:session.programVersion,name:session.programNameSnapshot||base.name},planned={id:session.plannedSessionId,name:session.plannedSessionNameSnapshot||"Planned Session",drills:(session.drills||[]).map(function(drill){const definition={id:drill.drillId,name:drill.nameSnapshot,trackingMode:drill.trackingMode};if(drill.plannedTargetSnapshot)definition.target=mfBasketballClone(drill.plannedTargetSnapshot);if(drill.prescriptionSnapshot)definition.prescription=mfBasketballClone(drill.prescriptionSnapshot);if(drill.confidence!=null||mfBasketballFindDrillDefinition(drill.drillId)&&mfBasketballFindDrillDefinition(drill.drillId).confidence)definition.confidence=true;return definition;})};if(typeof showScreen==="function")showScreen("log");const section=document.getElementById("p6sec-basketball");if(section)section.classList.add("open");mfBasketballOpenStructuredLogger(program,planned,session);
}

function mfBasketballCloseStructured(){const root=document.getElementById("mfBasketballStructuredLogger");if(root)root.hidden=true;if(document.body&&document.body.classList)document.body.classList.remove("mf-basketball-structured-open");mfBasketballStructuredContext=null;mfBasketballStructuredIndex=0;mfBasketballShowStructuredMessage("");}

function mfBasketballCollectStructuredDrills(){
  const root=document.getElementById("mfBasketballDrillLogger"),results=[];if(!root)return results;
  root.querySelectorAll(".mf-basketball-drill-card").forEach(function(card){
    const get=function(field){const input=card.querySelector("[data-field='"+field+"']");return input?input.value:null;};
    const mode=card.dataset.trackingMode,actual={};if(mode==="confidence"||mode==="duration")actual.durationMinutes=get("durationMinutes");if(mode==="makes_target")actual.makes=get("makes");if(mode==="benchmark_shooting"){actual.made=get("made");actual.attempted=get("attempted");}if(mode==="count")actual.count=get("count");if(mode==="completion"){const completed=get("completed");actual.completed=completed===""||completed==null?null:completed==="true";}
    results.push({drillId:card.dataset.drillId,actualResult:actual,confidence:get("confidence"),notes:get("notes")});
  });return results;
}

function mfBasketballUpdateStructuredSummary(){
  if(!mfBasketballStructuredContext)return;const root=document.getElementById("mfBasketballSessionSummary");if(!root)return;root.replaceChildren();root.appendChild(mfBasketballElement("div","mf-basketball-summary-title","SESSION SUMMARY"));
  const minutes=mfBasketballFormValue("mfBasketballStructuredMinutes");root.appendChild(mfBasketballElement("div","mf-basketball-summary-row","Duration: "+(minutes?minutes+" min":"not entered")));
  const calories=mfBasketballFormValue("mfBasketballStructuredActiveCalories");root.appendChild(mfBasketballElement("div","mf-basketball-summary-row","Active calories estimate: "+(calories!==""?calories+" kcal (watch/wearable)":"not recorded")));
  const results=mfBasketballCollectStructuredDrills(),byId={};results.forEach(function(result){byId[result.drillId]=result;});mfBasketballStructuredContext.planned.drills.forEach(function(drill){const entry=byId[drill.id]||{},actual=entry.actualResult||{},attempted=mfBasketballDrillWasAttempted(entry,drill.trackingMode);let value="Skipped";if(attempted&&drill.trackingMode==="confidence")value=entry.confidence?entry.confidence+"/10":"Incomplete — confidence required";if(attempted&&drill.trackingMode==="duration")value=mfBasketballHasEnteredValue(actual.durationMinutes)?actual.durationMinutes+" min":"Incomplete result";if(attempted&&drill.trackingMode==="makes_target")value=mfBasketballHasEnteredValue(actual.makes)?actual.makes+" / "+drill.target.makes+" makes":"Incomplete result";if(attempted&&drill.trackingMode==="benchmark_shooting")value=mfBasketballHasEnteredValue(actual.made)&&mfBasketballHasEnteredValue(actual.attempted)?actual.made+" / "+actual.attempted+" ("+(Math.round(Number(actual.made)/Number(actual.attempted)*1000)/10)+"%)":"Incomplete benchmark";if(attempted&&drill.trackingMode==="count")value=mfBasketballHasEnteredValue(actual.count)?actual.count+" / "+drill.target.count:"Incomplete result";if(attempted&&drill.trackingMode==="completion")value=actual.completed===true?"Completed":"Not completed";root.appendChild(mfBasketballElement("div","mf-basketball-summary-row",drill.name+": "+value));});
  const logger=document.getElementById("mfBasketballDrillLogger");if(logger)logger.querySelectorAll(".mf-basketball-drill-card").forEach(function(card){if(card.dataset.trackingMode!=="benchmark_shooting")return;const made=card.querySelector("[data-field='made']"),attempted=card.querySelector("[data-field='attempted']"),out=card.querySelector("[data-role='percentage']");if(out)out.textContent=made&&attempted&&made.value!==""&&attempted.value!==""&&Number(attempted.value)>0&&Number(made.value)<=Number(attempted.value)?"Percentage: "+(Math.round(Number(made.value)/Number(attempted.value)*1000)/10)+"%":"Percentage: —";});
}

function mfBasketballRenderCompletionReview(session,advanced){
  const root=document.getElementById("mfBasketballCompletionReview");if(!root||!session)return;root.replaceChildren();root.hidden=false;mfBasketballLastCompletion=session.id;
  root.appendChild(mfBasketballElement("div","mf-basketball-summary-title","SESSION COMPLETED"));root.appendChild(mfBasketballElement("div","mf-basketball-completion-title",session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type)));
  const drills=session.drills||[],completed=drills.filter(function(drill){return !drill.skipped;}),skipped=drills.filter(function(drill){return drill.skipped;}),energy=session.activeCalories==null?"":" · "+session.activeCalories+" active kcal estimate";root.appendChild(mfBasketballElement("div","mf-basketball-completion-meta",session.minutes+" min"+energy+" · "+completed.length+" of "+drills.length+" drills recorded · "+skipped.length+" skipped"));
  const list=mfBasketballElement("div","mf-basketball-completion-results"),sessions=mfBasketballReadStore().sessions;drills.forEach(function(drill){const row=mfBasketballElement("div","mf-basketball-completion-result"),value=mfBasketballElement("span","",mfBasketballDrillResultText(drill));row.append(mfBasketballElement("strong","",drill.nameSnapshot),value);if(!drill.skipped){const definition={id:drill.drillId,name:drill.nameSnapshot,trackingMode:drill.trackingMode,target:drill.plannedTargetSnapshot||null},progression=mfBasketballProgressionForDrill(drill.drillId,sessions,definition,{programId:session.programId,programVersion:session.programVersion,plannedSessionId:session.plannedSessionId,trackingMode:drill.trackingMode});row.appendChild(mfBasketballElement("small","",progression.label));}list.appendChild(row);});root.appendChild(list);
  const state=mfBasketballReadProgramState(),program=mfBasketballGetResolvedProgram(state.state.activeProgramId,state.state.activeProgramVersion),next=program&&program.sessions[state.state.nextSessionIndex];root.appendChild(mfBasketballElement("div","mf-basketball-completion-next",advanced&&next?"Next: "+next.name:"Queue unchanged: this session remains next"));
  const dismiss=mfBasketballElement("button","mf-basketball-completion-dismiss","DONE");dismiss.type="button";dismiss.addEventListener("click",function(){root.hidden=true;root.replaceChildren();});root.appendChild(dismiss);root.scrollIntoView({behavior:"smooth",block:"start"});
}

function mfBasketballFinishFromUI(action){
  if(!mfBasketballStructuredContext||mfBasketballSaving)return;mfBasketballSaving=true;const advance=document.getElementById("mfBasketballFinishAdvance"),repeat=document.getElementById("mfBasketballFinishRepeat");if(advance)advance.disabled=true;if(repeat)repeat.disabled=true;
  try{
    const context=mfBasketballStructuredContext,programSnapshot=context.existingId?{id:context.programId,version:context.programVersion,name:document.getElementById("mfBasketballStructuredProgram").textContent}:null,result=mfBasketballFinishStructuredSession({programId:context.programId,programVersion:context.programVersion,plannedSessionId:context.plannedSessionId,date:mfBasketballFormValue("mfBasketballStructuredDate"),minutes:mfBasketballFormValue("mfBasketballStructuredMinutes"),activeCalories:mfBasketballFormValue("mfBasketballStructuredActiveCalories"),notes:mfBasketballFormValue("mfBasketballStructuredNotes"),drills:mfBasketballCollectStructuredDrills(),existingId:context.existingId,programSnapshot:programSnapshot,plannedSnapshot:context.existingId?context.planned:null},context.existingId?"edit":action);
    if(!result.ok){mfBasketballShowStructuredMessage(result.errors.join("\n"),"error");return;}mfBasketballCloseStructured();mfBasketballRenderProgramSurface();mfBasketballRenderHistory();mfBasketballRenderStats();mfBasketballUpdateBadge();if(!context.existingId)mfBasketballRenderCompletionReview(result.session,result.advanced);mfBasketballShowMessage(context.existingId?"Structured basketball session updated.":result.advanced?"Session saved. The program advanced to the next session.":"Session saved. This planned session remains next.","ok");
  }finally{mfBasketballSaving=false;if(advance)advance.disabled=false;if(repeat)repeat.disabled=false;}
}

function mfBasketballOpenProgramDialog(action){
  mfBasketballPendingProgramAction=action;const dialog=document.getElementById("mfBasketballProgramDialog"),title=document.getElementById("mfBasketballProgramDialogTitle"),body=document.getElementById("mfBasketballProgramDialogBody"),confirm=document.getElementById("mfBasketballProgramDialogConfirm");if(!dialog)return;
  if(action.kind==="restart"){if(title)title.textContent="Restart basketball program?";if(body)body.textContent="The active queue will return to Session 1. Basketball history will not be deleted or rewritten.";if(confirm)confirm.textContent="RESTART PROGRAM";}else{const program=mfBasketballGetProgram(action.programId);if(title)title.textContent="Change basketball program?";if(body)body.textContent="Switch to "+(program?program.name:"the selected program")+" and start from Session 1? Existing history will be preserved.";if(confirm)confirm.textContent="CHANGE PROGRAM";}
  dialog.classList.add("open");dialog.setAttribute("aria-hidden","false");if(document.body&&document.body.classList)document.body.classList.add("mf-basketball-dialog-open");const cancel=document.getElementById("mfBasketballProgramDialogCancel");if(cancel)cancel.focus();
}

function mfBasketballCloseProgramDialog(){mfBasketballPendingProgramAction=null;const dialog=document.getElementById("mfBasketballProgramDialog");if(dialog){dialog.classList.remove("open");dialog.setAttribute("aria-hidden","true");}if(document.body&&document.body.classList)document.body.classList.remove("mf-basketball-dialog-open");}

function mfBasketballConfirmProgramAction(){
  const action=mfBasketballPendingProgramAction;if(!action)return;let result;if(action.kind==="restart")result=mfBasketballRestartProgram();else result=mfBasketballSelectProgram(action.programId);mfBasketballCloseProgramDialog();if(!result.ok){mfBasketballShowMessage(result.error||"Basketball program could not be updated.","error");return;}mfBasketballCloseStructured();mfBasketballRenderProgramSurface();mfBasketballShowMessage(action.kind==="restart"?"Basketball program restarted from Session 1.":"Basketball program selected. Session 1 is next.","ok");
}

function mfBasketballChooseProgramFromUI(){
  const select=document.getElementById("mfBasketballProgramSelect"),programId=select&&select.value,current=mfBasketballReadProgramState().state.activeProgramId;if(!programId){mfBasketballShowMessage("Choose a basketball program.","error");return;}if(current===programId){mfBasketballShowMessage("That basketball program is already active.","ok");return;}if(current)mfBasketballOpenProgramDialog({kind:"select",programId:programId});else{const result=mfBasketballSelectProgram(programId);if(!result.ok)mfBasketballShowMessage(result.error,"error");else{mfBasketballRenderProgramSurface();mfBasketballShowMessage("Basketball program selected. Session 1 is next.","ok");}}
}

function mfBasketballCollectForm(){
  return {
    date:mfBasketballFormValue("mfBasketballDate"),type:mfBasketballFormValue("mfBasketballType"),minutes:mfBasketballFormValue("mfBasketballMinutes"),
    dribblingMinutes:mfBasketballFormValue("mfBasketballDribbling"),shootingMade:mfBasketballFormValue("mfBasketballShootingMade"),shootingAttempted:mfBasketballFormValue("mfBasketballShootingAttempted"),
    freeThrowsMade:mfBasketballFormValue("mfBasketballFreeThrowsMade"),freeThrowsAttempted:mfBasketballFormValue("mfBasketballFreeThrowsAttempted"),notes:mfBasketballFormValue("mfBasketballNotes")
  };
}

function mfBasketballShowMessage(message,type){
  const el=document.getElementById("mfBasketballMessage");if(!el)return;
  el.textContent=message||"";el.className="mf-basketball-message"+(message?" "+(type||"ok"):"");
}

function mfBasketballResetForm(preserveMessage){
  mfBasketballEditingId=null;
  ["mfBasketballType","mfBasketballMinutes","mfBasketballDribbling","mfBasketballShootingMade","mfBasketballShootingAttempted","mfBasketballFreeThrowsMade","mfBasketballFreeThrowsAttempted","mfBasketballNotes"].forEach(function(id){mfBasketballSetFormValue(id,"");});
  mfBasketballSetFormValue("mfBasketballDate",mfBasketballSelectedAppDate());
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel");
  if(save)save.textContent="SAVE BASKETBALL SESSION";
  if(cancel)cancel.hidden=true;
  if(!preserveMessage)mfBasketballShowMessage("");
  mfBasketballUpdateBadge();
}

function mfBasketballSaveFromUI(){
  if(mfBasketballSaving)return;
  const button=document.getElementById("mfBasketballSave");mfBasketballSaving=true;if(button)button.disabled=true;
  try{
    const result=mfBasketballSaveSession(mfBasketballCollectForm(),{existingId:mfBasketballEditingId||""});
    if(!result.ok){mfBasketballShowMessage(result.errors.join("\n"),"error");return;}
    const edited=!!mfBasketballEditingId;
    mfBasketballResetForm(true);
    mfBasketballShowMessage(edited?"Basketball session updated.":"Basketball session saved.","ok");
    mfBasketballRenderHistory();mfBasketballRenderStats();
  }finally{mfBasketballSaving=false;if(button)button.disabled=false;}
}

function mfBasketballStartEdit(id){
  const session=mfBasketballReadStore().sessions.find(function(item){return item.id===id;});if(!session)return;
  if(Array.isArray(session.drills)){mfBasketballStartStructuredEdit(session);return;}
  mfBasketballEditingId=session.id;
  mfBasketballSetFormValue("mfBasketballDate",session.date);mfBasketballSetFormValue("mfBasketballType",session.type);mfBasketballSetFormValue("mfBasketballMinutes",session.minutes);
  mfBasketballSetFormValue("mfBasketballDribbling",session.dribblingMinutes);mfBasketballSetFormValue("mfBasketballShootingMade",session.shooting&&session.shooting.made);mfBasketballSetFormValue("mfBasketballShootingAttempted",session.shooting&&session.shooting.attempted);
  mfBasketballSetFormValue("mfBasketballFreeThrowsMade",session.freeThrows&&session.freeThrows.made);mfBasketballSetFormValue("mfBasketballFreeThrowsAttempted",session.freeThrows&&session.freeThrows.attempted);mfBasketballSetFormValue("mfBasketballNotes",session.notes||"");
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel"),section=document.getElementById("p6sec-basketball");
  if(save)save.textContent="SAVE SESSION CHANGES";if(cancel)cancel.hidden=false;if(section)section.classList.add("open");
  mfBasketballShowMessage("Editing "+mfBasketballTypeLabel(session.type)+" from "+mfBasketballFormatDate(session.date)+".","ok");
  if(typeof showScreen==="function")showScreen("log");
  if(section&&typeof section.scrollIntoView==="function")section.scrollIntoView({behavior:"smooth",block:"start"});
  const dateInput=document.getElementById("mfBasketballDate");if(dateInput&&typeof dateInput.focus==="function")dateInput.focus();
}

function mfBasketballOpenDelete(id){
  const session=mfBasketballReadStore().sessions.find(function(item){return item.id===id;});if(!session)return;
  mfBasketballPendingDeleteId=id;
  const dialog=document.getElementById("mfBasketballDeleteDialog"),body=document.getElementById("mfBasketballDeleteBody");
  if(body)body.textContent="Delete "+mfBasketballTypeLabel(session.type)+" on "+mfBasketballFormatDate(session.date)+"? This removes only this basketball record.";
  if(dialog){dialog.classList.add("open");dialog.setAttribute("aria-hidden","false");}
  if(document.body&&document.body.classList)document.body.classList.add("mf-basketball-dialog-open");
  const cancel=document.getElementById("mfBasketballDeleteCancel");if(cancel&&typeof cancel.focus==="function")cancel.focus();
}

function mfBasketballCloseDelete(){
  mfBasketballPendingDeleteId=null;const dialog=document.getElementById("mfBasketballDeleteDialog");
  if(dialog){dialog.classList.remove("open");dialog.setAttribute("aria-hidden","true");}
  if(document.body&&document.body.classList)document.body.classList.remove("mf-basketball-dialog-open");
}

function mfBasketballConfirmDelete(){
  const id=mfBasketballPendingDeleteId;if(!id)return;
  const deleted=mfBasketballDeleteSession(id);mfBasketballCloseDelete();
  if(deleted){if(mfBasketballEditingId===id)mfBasketballResetForm();mfBasketballRenderHistory();mfBasketballRenderStats();mfBasketballUpdateBadge();}
}

function mfBasketballHistoryFilters(sessions){
  const value=function(id){const el=document.getElementById(id);return el?String(el.value||""):"";};
  const from=value("hf-from"),to=value("hf-to"),gym=value("hf-gym"),woday=value("hf-woday"),search=value("hf-search").trim().toLowerCase();
  if(gym||woday||(typeof p7FilterState!=="undefined"&&(p7FilterState.hasWorkout||p7FilterState.hasHabits)))return [];
  return sessions.filter(function(session){
    if(from&&session.date<from)return false;if(to&&session.date>to)return false;
    if(typeof p7FilterState!=="undefined"&&p7FilterState.hasNotes&&!session.notes)return false;
    if(search){const drillText=(session.drills||[]).map(function(drill){return drill.nameSnapshot+" "+(drill.notes||"");}).join(" "),haystack=(mfBasketballTypeLabel(session.type)+" "+(session.notes||"")+" "+(session.programNameSnapshot||"")+" "+(session.plannedSessionNameSnapshot||"")+" "+drillText+" basketball").toLowerCase();if(haystack.indexOf(search)===-1)return false;}
    return true;
  });
}

function mfBasketballMetricNode(text){const span=document.createElement("span");span.className="mf-basketball-metric";span.textContent=text;return span;}

function mfBasketballDrillResultText(drill){
  if(drill.skipped)return "Skipped";
  const result=drill.actualResult||{},target=drill.plannedTargetSnapshot||{};
  if(drill.trackingMode==="confidence")return result.durationMinutes!=null?result.durationMinutes+" min":"Skill work";
  if(drill.trackingMode==="duration")return result.durationMinutes+" / "+target.durationMinutes+" min";
  if(drill.trackingMode==="makes_target")return result.makes+" / "+target.makes+" makes";
  if(drill.trackingMode==="benchmark_shooting")return result.made+" / "+result.attempted+" ("+result.percentage+"%)";
  if(drill.trackingMode==="count")return result.count+" / "+target.count;
  return result.completed?"Completed":"Not completed";
}

function mfBasketballToggleProgramView(){const root=document.getElementById("mfBasketballProgramView"),button=document.getElementById("mfBasketballViewProgram");if(!root)return;root.hidden=!root.hidden;if(button)button.textContent=root.hidden?"VIEW PROGRAM":"HIDE PROGRAM";if(!root.hidden)root.scrollIntoView({behavior:"smooth",block:"nearest"});}

function mfBasketballReviewHistory(){if(typeof showScreen==="function")showScreen("history");const root=document.getElementById("mfBasketballHistory");if(root)root.scrollIntoView({behavior:"smooth",block:"start"});}

function mfBasketballHistoryThroughSession(sessions,current){
  const key=String(current.date||"")+"|"+String(current.createdAt||"")+"|"+String(current.id||"");return (sessions||[]).filter(function(session){return String(session.date||"")+"|"+String(session.createdAt||"")+"|"+String(session.id||"")<=key;});
}

function mfBasketballRenderHistory(){
  const container=document.getElementById("mfBasketballHistory");if(!container)return;
  container.replaceChildren();container.className="mf-basketball-history-section";
  const heading=document.createElement("div");heading.className="mf-basketball-history-heading";mfBasketballSetIconLabel(heading,"basketball","Basketball Sessions");container.appendChild(heading);
  const state=mfBasketballReadStore(),sessions=mfBasketballHistoryFilters(state.sessions);
  if(!sessions.length){const empty=document.createElement("div");empty.className="mf-basketball-history-empty";empty.textContent=state.parseOk?"No basketball sessions match the current History filters.":"Basketball storage is unavailable; other History entries are unaffected.";container.appendChild(empty);return;}
  sessions.forEach(function(session){
    const details=document.createElement("details");details.className="mf-basketball-entry";details.dataset.sessionId=session.id;
    const summary=document.createElement("summary"),title=document.createElement("div"),meta=document.createElement("div");title.className="mf-basketball-entry-title";meta.className="mf-basketball-entry-meta";
    mfBasketballSetIconLabel(title,"basketball",session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type),"mf-icon-sm");meta.textContent=session.minutes+" min · "+mfBasketballFormatDate(session.date);summary.append(title,meta);details.appendChild(summary);
    const body=document.createElement("div");body.className="mf-basketball-entry-detail";const metrics=document.createElement("div");metrics.className="mf-basketball-metrics";metrics.appendChild(mfBasketballMetricNode(session.minutes+" total minutes"));if(session.activeCalories!=null)metrics.appendChild(mfBasketballMetricNode(session.activeCalories+" active kcal · wearable estimate"));
    if(session.programNameSnapshot){const program=mfBasketballElement("div","mf-basketball-history-program",session.programNameSnapshot+" · "+session.plannedSessionNameSnapshot);body.appendChild(program);}
    if(session.dribblingMinutes!=null)metrics.appendChild(mfBasketballMetricNode(session.dribblingMinutes+" dribbling minutes"));
    if(session.shooting){const pct=mfBasketballPercent(session.shooting);metrics.appendChild(mfBasketballMetricNode("Shooting "+session.shooting.made+" / "+session.shooting.attempted+(pct==null?"":" ("+pct+"%)")));}
    if(session.freeThrows){const pct=mfBasketballPercent(session.freeThrows);metrics.appendChild(mfBasketballMetricNode("Free throws "+session.freeThrows.made+" / "+session.freeThrows.attempted+(pct==null?"":" ("+pct+"%)")));}
    body.appendChild(metrics);
    if(Array.isArray(session.drills)){
      const drillList=mfBasketballElement("div","mf-basketball-history-drills"),evidence=mfBasketballHistoryThroughSession(state.sessions,session);session.drills.forEach(function(drill){const row=mfBasketballElement("div","mf-basketball-history-drill"),head=mfBasketballElement("div","mf-basketball-history-drill-head"),name=mfBasketballElement("strong","",drill.nameSnapshot),value=mfBasketballElement("span","",mfBasketballDrillResultText(drill));head.append(name,value);row.appendChild(head);if(drill.prescriptionSnapshot){row.appendChild(mfBasketballElement("div","mf-basketball-history-prescription",drill.prescriptionSnapshot.doNow));mfBasketballAppendPrescriptionDetails(row,drill.prescriptionSnapshot);}if(drill.confidence!=null)row.appendChild(mfBasketballElement("div","mf-basketball-history-confidence","Confidence "+drill.confidence+" / 10"));if(!drill.skipped){const definition={id:drill.drillId,name:drill.nameSnapshot,trackingMode:drill.trackingMode,target:drill.plannedTargetSnapshot||null},progression=mfBasketballProgressionForDrill(drill.drillId,evidence,definition,{programId:session.programId,programVersion:session.programVersion,plannedSessionId:session.plannedSessionId,trackingMode:drill.trackingMode});row.appendChild(mfBasketballElement("div","mf-basketball-history-guidance",progression.label+" — "+progression.guidance));}if(drill.notes)row.appendChild(mfBasketballElement("div","mf-basketball-notes",drill.notes));drillList.appendChild(row);});body.appendChild(drillList);
    }
    if(session.notes){const notes=document.createElement("div");notes.className="mf-basketball-notes";notes.textContent=session.notes;body.appendChild(notes);}
    const actions=document.createElement("div");actions.className="mf-basketball-card-actions";const edit=document.createElement("button"),remove=document.createElement("button");edit.type="button";remove.type="button";edit.className="mf-basketball-edit";remove.className="mf-basketball-delete";edit.textContent="EDIT";remove.textContent="DELETE";edit.addEventListener("click",function(event){event.preventDefault();mfBasketballStartEdit(session.id);});remove.addEventListener("click",function(event){event.preventDefault();mfBasketballOpenDelete(session.id);});actions.append(edit,remove);body.appendChild(actions);details.appendChild(body);container.appendChild(details);
  });
}

function mfBasketballRenderStats(){
  const container=document.getElementById("mfBasketballStats");if(!container)return;
  const state=mfBasketballReadStore(),range=typeof p7GetStatsRange==="function"?p7GetStatsRange():{start:null,end:null,label:"All history"},sessions=state.sessions.filter(function(session){return (!range.start||session.date>=range.start)&&(!range.end||session.date<=range.end);}),stats=mfBasketballAggregate(sessions);container.replaceChildren();container.className="p7-section mf-basketball-stats";const heading=mfBasketballElement("div","p7-section-header","");mfBasketballSetIconLabel(heading,"basketball","Basketball · "+range.label);container.appendChild(heading);
  function statCard(label,value,sub,className){const card=mfBasketballElement("div","p7-stat-card "+(className||"")),labelNode=mfBasketballElement("div","p7-stat-label",label),valueNode=mfBasketballElement("div","p7-stat-val "+(className||""),value),subNode=mfBasketballElement("div","p7-stat-sub",sub);card.append(labelNode,valueNode,subNode);return card;}
  const primary=mfBasketballElement("div","p7-stat-grid cols3");primary.append(statCard("Sessions",stats.totalSessions,"all basketball","accent"),statCard("Minutes",stats.totalMinutes,"basketball only","orange"),statCard("Structured",stats.structuredSessions,"program sessions",""));container.appendChild(primary);
  const secondary=mfBasketballElement("div","p7-stat-grid");secondary.append(statCard("Average",stats.totalSessions?stats.averageMinutes.toFixed(1):"—","minutes / session",""),statCard("Free Throws",stats.freeThrows.attempted?stats.freeThrows.made+" / "+stats.freeThrows.attempted:"—",stats.freeThrows.percentage==null?"free-form totals":stats.freeThrows.percentage.toFixed(1)+"%",""));container.appendChild(secondary);
  const calories=mfBasketballCollectActiveCalories(range,state.sessions),energy=mfBasketballElement("div","p7-wide-card mf-active-calories-stats");energy.appendChild(mfBasketballElement("div","p7-wide-card-title","Recorded Active Calories · Estimates"));const energyGrid=mfBasketballElement("div","p7-stat-grid cols3");energyGrid.append(statCard("Total",calories.recorded?calories.total.toLocaleString():"—",calories.recorded+" calorie-recorded session"+(calories.recorded===1?"":"s"),"orange"),statCard("Average",calories.average==null?"—":calories.average.toFixed(0),"per calorie-recorded session",""),statCard("Coverage",calories.recorded+" of "+calories.supported,"supported sessions",""),statCard("Lifting",calories.liftingRecorded?calories.liftingTotal.toLocaleString():"—",calories.liftingRecorded+" recorded estimate"+(calories.liftingRecorded===1?"":"s"),""),statCard("Basketball",calories.basketballRecorded?calories.basketballTotal.toLocaleString():"—",calories.basketballRecorded+" recorded estimate"+(calories.basketballRecorded===1?"":"s"),"accent"));energy.appendChild(energyGrid);energy.appendChild(mfBasketballElement("div","p7-muted",calories.recorded?"Wearable/user-entered estimates; missing sessions are excluded from totals and averages.":"No active-calorie estimates are recorded in this range."));container.appendChild(energy);
  const practiced=Object.keys(stats.drillCounts).map(function(id){return {id:id,name:stats.drillCounts[id].name,count:stats.drillCounts[id].count};}).sort(function(a,b){return b.count-a.count||a.name.localeCompare(b.name);}).slice(0,5);
  if(practiced.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Most-Practiced Drills");card.appendChild(title);practiced.forEach(function(item){const row=mfBasketballElement("div","mf-basketball-recent-row");row.append(mfBasketballElement("span","",item.name),mfBasketballElement("span","",item.count+" exposure"+(item.count===1?"":"s")));card.appendChild(row);});container.appendChild(card);}
  const confidence=Object.keys(stats.confidenceByDrill).map(function(id){return stats.confidenceByDrill[id];}).filter(function(item){return item.values.length>=2;}).sort(function(a,b){return b.values.length-a.values.length||a.name.localeCompare(b.name);}).slice(0,4);
  if(confidence.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Skill Confidence Trends");card.appendChild(title);confidence.forEach(function(item){const values=item.values.slice(0,3).reverse().map(function(point){return point.value;});const row=mfBasketballElement("div","mf-basketball-trend-row");row.append(mfBasketballElement("span","",item.name),mfBasketballElement("strong","",values.join(" → ")+" / 10"));card.appendChild(row);});container.appendChild(card);}
  const benchmarks=Object.keys(stats.benchmarksByDrill).map(function(id){return stats.benchmarksByDrill[id];}).filter(function(item){return item.values.length>=2;}).sort(function(a,b){return b.values.length-a.values.length||a.name.localeCompare(b.name);}).slice(0,4);
  if(benchmarks.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Shooting Benchmarks");card.appendChild(title);benchmarks.forEach(function(item){const values=item.values.slice(0,3).reverse().map(function(point){return point.percentage+"%";});const row=mfBasketballElement("div","mf-basketball-trend-row");row.append(mfBasketballElement("span","",item.name),mfBasketballElement("strong","",values.join(" → ")));card.appendChild(row);});container.appendChild(card);}
  if(sessions.length){if(!confidence.length&&!benchmarks.length)container.appendChild(mfBasketballElement("div","p7-muted","Insufficient identity-comparable exposures for a Basketball trend."));const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Recent Basketball Sessions"),recent=mfBasketballElement("div","mf-basketball-recent");card.appendChild(title);sessions.slice(0,5).forEach(function(session){const row=mfBasketballElement("div","mf-basketball-recent-row");row.append(mfBasketballElement("span","",session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type)),mfBasketballElement("span","",session.minutes+" min · "+session.date));recent.appendChild(row);});card.appendChild(recent);container.appendChild(card);}else container.appendChild(mfBasketballElement("div","mf-basketball-history-empty","No basketball sessions in this range."));
}

function mfBasketballUpdateBadge(){
  const badge=document.getElementById("mfBasketballBadge");if(!badge)return;
  const date=mfBasketballSelectedAppDate(),count=mfBasketballReadStore().sessions.filter(function(session){return session.date===date;}).length;
  badge.textContent=count?count+" session"+(count===1?"":"s")+" this date":"No sessions";badge.className="p6-section-badge"+(count?" done":"");
}

function mfBasketballSessionsForRange(range,sessions){
  if(range==="program")return [];
  if(range==="full")return sessions.slice();
  const days=parseInt(range,10);if(!Number.isFinite(days))return [];
  const cutoff=new Date();cutoff.setHours(12,0,0,0);cutoff.setDate(cutoff.getDate()-days);
  const cutoffKey=mfBasketballDateKey(cutoff);return sessions.filter(function(session){return session.date>=cutoffKey;});
}

function mfBasketballBuildExport(range,sessions,programStateValue){
  const rangeValue=String(range||""),allSessions=Array.isArray(sessions)?sessions:[],selected=mfBasketballSessionsForRange(rangeValue,allSessions),stateResult=programStateValue&&programStateValue.state?programStateValue:programStateValue?mfBasketballParseProgramStateValue(programStateValue):mfBasketballReadProgramState(),program=stateResult.parseOk&&mfBasketballGetResolvedProgram(stateResult.state.activeProgramId,stateResult.state.activeProgramVersion),next=program&&program.sessions[stateResult.state.nextSessionIndex],calorieRange={start:null,end:null};if(rangeValue==="program")calorieRange.start="9999-12-31";else if(rangeValue!=="full"){const days=parseInt(rangeValue,10),cutoff=new Date();if(Number.isFinite(days)){cutoff.setHours(12,0,0,0);cutoff.setDate(cutoff.getDate()-days);calorieRange.start=mfBasketballDateKey(cutoff);}}
  const calories=mfBasketballCollectActiveCalories(calorieRange,allSessions);if(!selected.length&&!program&&!calories.recorded&&!calories.supported)return "";
  const stats=mfBasketballAggregate(selected),overrides=mfBasketballReadOverrides(),overrideCounts=mfBasketballOverrideCounts(overrides.store),proposal=mfBasketballGetProposal();let output="";
  if(rangeValue!=="program")output+="--- ACTIVE CALORIE ESTIMATES ---\nSource: optional user-entered watch/wearable estimates; not precise energy expenditure.\nRecorded total: "+(calories.recorded?calories.total+" active kcal":"not recorded")+" | Average: "+(calories.average==null?"not recorded":calories.average.toFixed(0)+" active kcal per calorie-recorded session")+"\nLifting: "+(calories.liftingRecorded?calories.liftingTotal+" active kcal across "+calories.liftingRecorded+" session(s)":"no recorded estimates")+" | Basketball: "+(calories.basketballRecorded?calories.basketballTotal+" active kcal across "+calories.basketballRecorded+" structured session(s)":"no recorded estimates")+"\nCoverage: "+calories.recorded+" of "+calories.supported+" supported sessions include an estimate; missing sessions are excluded, not treated as zero.\n\n";
  if(!selected.length&&!program)return output;
  output+="--- BASKETBALL ACTIVITY ---\nTracking preference: "+(typeof p950IsTrackingEnabled!=="function"||p950IsTrackingEnabled("modules.basketball")?"on":"intentionally off; absence of new sessions is neutral")+".\n";
  if(program){output+="Active program: "+program.name+" [programId="+program.id+", version="+program.version+"]\n";output+="Next planned session: "+next.name+" [sessionId="+next.id+"] | Position "+(stateResult.state.nextSessionIndex+1)+" of "+program.sessions.length+"\n";output+="Resolved next drills:\n";const progressionLines=[];next.drills.forEach(function(drill,index){const source=drill.source==="ai_proposal"||drill.personalization?"personalized":"base",progression=mfBasketballProgressionForDrill(drill.id,allSessions,drill,mfBasketballIdentity(program,next,drill)),prescription=mfBasketballPrescriptionFor(drill);output+="  "+(index+1)+". "+drill.name+" [drillId="+drill.id+", mode="+drill.trackingMode+", source="+source+"] — "+mfBasketballDescribeTarget(drill)+"\n";if(prescription)output+="     "+mfBasketballExportPrescription(prescription,"Planned/resolved prescription")+"\n";if(progression.exposures.length)progressionLines.push("  · "+drill.name+": "+progression.label+" — "+progression.guidance);});if(progressionLines.length)output+="Derived progression context (comparable identity only):\n"+progressionLines.join("\n")+"\n";}
  output+="Applied personalization: "+overrideCounts.modified+" modified, "+overrideCounts.added+" added, "+overrideCounts.disabled+" disabled, "+overrideCounts.reordered+" reordered session(s).\n";
  output+="Pending basketball proposal: "+(proposal&&proposal.status==="pending"?proposal.summary+" ("+proposal.changes.length+" actions; review required)":"none")+".\n";
  if(selected.length)output+="Sessions: "+stats.totalSessions+" | Structured: "+stats.structuredSessions+" | Total minutes: "+stats.totalMinutes+" | Average minutes: "+stats.averageMinutes.toFixed(1)+"\n";
  if(stats.shooting.attempted>0)output+="Shooting: "+stats.shooting.made+" / "+stats.shooting.attempted+" ("+stats.shooting.percentage.toFixed(1)+"%)\n";
  if(stats.freeThrows.attempted>0)output+="Free throws: "+stats.freeThrows.made+" / "+stats.freeThrows.attempted+" ("+stats.freeThrows.percentage.toFixed(1)+"%)\n";
  selected.forEach(function(session){const evidence=mfBasketballHistoryThroughSession(allSessions,session);let line="- "+session.date+" | "+(session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type))+" | "+session.minutes+" min";if(session.activeCalories!=null)line+=" | active calories "+session.activeCalories+" kcal (wearable/user estimate)";if(session.programNameSnapshot)line+=" | program: "+session.programNameSnapshot+" v"+session.programVersion;if(session.dribblingMinutes!=null)line+=" | dribbling "+session.dribblingMinutes+" min";if(session.shooting)line+=" | shooting "+session.shooting.made+"/"+session.shooting.attempted;if(session.freeThrows)line+=" | FT "+session.freeThrows.made+"/"+session.freeThrows.attempted;if(session.notes)line+=" | notes: "+session.notes.replace(/\s+/g," ");output+=line+"\n";(session.drills||[]).forEach(function(drill){output+="  · "+drill.nameSnapshot+" [drillId="+drill.drillId+"]: "+mfBasketballDrillResultText(drill);if(drill.prescriptionSnapshot)output+=" | "+mfBasketballExportPrescription(drill.prescriptionSnapshot,"Historical performed prescription");if(!drill.skipped){const definition={id:drill.drillId,name:drill.nameSnapshot,trackingMode:drill.trackingMode,target:drill.plannedTargetSnapshot||null},progression=mfBasketballProgressionForDrill(drill.drillId,evidence,definition,{programId:session.programId,programVersion:session.programVersion,plannedSessionId:session.plannedSessionId,trackingMode:drill.trackingMode});output+=(drill.confidence!=null?" | confidence "+drill.confidence+"/10":"")+" | "+progression.label+" — "+progression.guidance;}output+=(drill.notes?" | note: "+drill.notes.replace(/\s+/g," "):"")+"\n";});});
  output+="Coaching guidance: Treat Basketball as skill practice plus conditioning/cardio load. Skipped drills are neutral. The queue is session-driven. Future-program definitions are proposal/review mutable only through modify_drill, add_drill (new IDs follow bball-ai-…-vN), remove_drill, reorder_drills, or switch_program; never auto-apply or auto-advance. Never target history, results, queue advancement, or stored snapshots.\n";
  return output+"\n";
}

function mf105BuildCrossDomainExport(context,range,sessions,programStateValue){
  const base=context&&context.baseSummary||{},selected=mfBasketballSessionsForRange(String(range||""),Array.isArray(sessions)?sessions:[]),stats=mfBasketballAggregate(selected),programState=programStateValue&&programStateValue.state?programStateValue:mfBasketballReadProgramState(),program=programState.parseOk&&mfBasketballGetResolvedProgram(programState.state.activeProgramId,programState.state.activeProgramVersion),habitProposal=typeof p960GetHabitProposal==="function"?p960GetHabitProposal():null,basketballProposal=mfBasketballGetProposal(),rotation=p9489AnalyzeExerciseRotation(),basketballOn=typeof p950IsTrackingEnabled!=="function"||p950IsTrackingEnabled("modules.basketball"),habitsOn=typeof p950IsTrackingEnabled!=="function"||p950IsTrackingEnabled("modules.habits"),conditioning=!basketballOn&&!stats.totalSessions?"Basketball collection is intentionally off; no absence or conditioning inference is made.":stats.totalSessions>0&&Number(base.dedicatedCardioSessions||0)===0?"Basketball is the only recorded conditioning/cardio source in this range; treat it as replacing dedicated cardio in the recorded evidence.":stats.totalSessions>0?"Basketball and dedicated cardio both occurred; review redundancy and total conditioning load.":"No Basketball conditioning was recorded in this enabled range.",interaction=!basketballOn&&!stats.totalSessions?"Basketball collection is intentionally off; no lower-body conflict inference is made.":stats.totalSessions>=2&&Number(base.lowerBodySessions||0)>=2?"Concurrent-load flag: multiple Basketball sessions and multiple lower-body lifting sessions occurred; review leg fatigue before progressing either domain.":"No obvious Basketball/lower-body volume conflict is established by the selected-range counts.";
  return "--- CROSS-DOMAIN COACHING SUMMARY ---\n"
    +"Selected evidence range: "+(base.rangeLabel||"current selection")+".\n"
    +"Training load: lifting "+(base.liftingSessions||0)+" session(s), including "+(base.lowerBodySessions||0)+" lower-body; Basketball "+stats.totalSessions+" session(s) / "+stats.totalMinutes+" min; dedicated cardio "+(base.dedicatedCardioSessions||0)+" session(s).\n"
    +"Scheduled Habit completion: "+(habitsOn?(base.habitAdherence||"n/a"):"tracking intentionally off; no negative adherence inference")+"; recurring medication adherence is reported in its own read-only section.\n"
    +"Program basis: lifting basis and resolved templates are authoritative below; Basketball program "+(program?program.name+" [programId="+program.id+", version="+program.version+"]":"none active")+".\n"
    +"Current experiments/recommendations: "+(base.activeRecommendationCount||0)+" active lifting recommendation record(s); rotation analysis found "+rotation.candidatesTotal+" candidate(s) and "+rotation.weakPointTotal+" weak-point/order signal(s).\n"
    +"Pending ownership: Habit proposal "+(habitProposal&&habitProposal.status==="pending"?"pending - do not replace":"none")+"; Basketball proposal "+(basketballProposal&&basketballProposal.status==="pending"?"pending - do not replace":"none")+".\n"
    +"Conditioning interaction: "+conditioning+"\n"
    +"Load interaction: "+interaction+"\n"
    +"Coaching priority: simplify when adherence is weak, avoid redundant conditioning or experiments, preserve what is working, and change only the domain with the clearest evidence. Unsupported domains remain advisory only.\n\n";
}

function mfBasketballValidateBackupStore(value){
  const parsed=mfBasketballParseStoreValue(value);
  if(!parsed.parseOk)throw new Error("Basketball backup data is malformed: "+parsed.error);
  if(parsed.invalidRecordCount)throw new Error("Basketball backup data contains "+parsed.invalidRecordCount+" invalid or duplicate record(s).");
  return parsed;
}

function mfBasketballValidateBackupProgramState(value){
  const parsed=mfBasketballParseProgramStateValue(value);
  if(!parsed.parseOk)throw new Error("Basketball program state in backup is malformed: "+parsed.error);
  return parsed.state;
}

function mfBasketballValidateBackupOverrides(value){
  const parsed=mfBasketballParseOverridesValue(value,{strict:true});if(!parsed.parseOk)throw new Error("Basketball overrides in backup are malformed: "+parsed.error);return parsed.store;
}

function mfBasketballValidateBackupProposal(value){
  let parsed;try{parsed=typeof value==="string"?JSON.parse(value):value;}catch(e){throw new Error("Basketball proposal in backup is not valid JSON.");}
  const proposal=mfBasketballNormalizeProposal(parsed),actions=["modify_drill","add_drill","remove_drill","reorder_drills","switch_program"];
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||proposal.schemaVersion!==MF_BASKETBALL_PROPOSAL_SCHEMA_VERSION||proposal.proposalVersion!==1)throw new Error("Basketball proposal in backup has an unsupported schema/version.");
  if(!/^bball-proposal-[a-z0-9][a-z0-9-]{2,79}$/i.test(proposal.proposalId)||["pending","applied","rejected","undone"].indexOf(proposal.status)===-1||!proposal.summary||!proposal.changes.length||proposal.changes.length>30)throw new Error("Basketball proposal in backup is malformed.");
  if(proposal.changes.some(function(change){return !change||typeof change!=="object"||actions.indexOf(String(change.action||"").toLowerCase())===-1;}))throw new Error("Basketball proposal in backup contains an unsupported action.");
  return proposal;
}

function mfBasketballOverrideCounts(store){
  const counts={programs:0,modified:0,added:0,disabled:0,reordered:0};Object.keys(store.programs||{}).forEach(function(programId){counts.programs++;Object.keys(store.programs[programId].sessions||{}).forEach(function(sessionId){const session=store.programs[programId].sessions[sessionId];counts.modified+=Object.keys(session.modified||{}).length;counts.added+=Object.keys(session.added||{}).length;counts.disabled+=Object.keys(session.disabled||{}).length;if(session.order)counts.reordered++;});});return counts;
}

function mfBasketballMarkBackupKeyRecognized(summary){
  if(summary.unknownKeyCount>0)summary.unknownKeyCount--;summary.warnings=(summary.warnings||[]).filter(function(warning){return !/key\(s\).*not recognized/i.test(warning);});if(summary.unknownKeyCount>0)summary.warnings.push(summary.unknownKeyCount+" key(s) in this backup are not recognized by the current app version.");
}

// Backup ownership and preview integration. Existing backups without this key remain valid.
if(typeof p8IsMarcusFitKey==="function"){
  const mfBasketballLegacyIsMarcusFitKey=p8IsMarcusFitKey;
  p8IsMarcusFitKey=function(key){return key===MF_BASKETBALL_STORAGE_KEY||key===MF_BASKETBALL_PROGRAM_STATE_KEY||key===MF_BASKETBALL_OVERRIDES_KEY||key===MF_BASKETBALL_PROPOSAL_KEY||mfBasketballLegacyIsMarcusFitKey(key);};
}
if(typeof p8492SummarizeBackup==="function"){
  const mfBasketballLegacySummarizeBackup=p8492SummarizeBackup;
  p8492SummarizeBackup=function(rawOrObj){
    const summary=mfBasketballLegacySummarizeBackup(rawOrObj),backup=typeof rawOrObj==="string"?function(){try{return JSON.parse(rawOrObj);}catch(e){return null;}}():rawOrObj;
    summary.hasBasketballSessions=false;summary.basketballSessionCount=0;summary.hasBasketballProgramState=false;summary.basketballProgramName=null;summary.basketballNextSession=null;summary.hasBasketballOverrides=false;summary.basketballOverrideCounts={programs:0,modified:0,added:0,disabled:0,reordered:0};summary.hasBasketballProposal=false;summary.basketballProposalStatus=null;
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_STORAGE_KEY)){
      summary.hasBasketballSessions=true;
      try{const parsed=mfBasketballValidateBackupStore(backup.data[MF_BASKETBALL_STORAGE_KEY]);summary.basketballSessionCount=parsed.sessions.length;mfBasketballMarkBackupKeyRecognized(summary);}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}
    }
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_PROGRAM_STATE_KEY)){
      summary.hasBasketballProgramState=true;
      try{const state=mfBasketballValidateBackupProgramState(backup.data[MF_BASKETBALL_PROGRAM_STATE_KEY]),program=mfBasketballGetProgram(state.activeProgramId,state.activeProgramVersion),next=program&&program.sessions[state.nextSessionIndex];summary.basketballProgramName=program&&program.name||null;summary.basketballNextSession=next&&next.name||null;mfBasketballMarkBackupKeyRecognized(summary);}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}
    }
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_OVERRIDES_KEY)){summary.hasBasketballOverrides=true;try{summary.basketballOverrideCounts=mfBasketballOverrideCounts(mfBasketballValidateBackupOverrides(backup.data[MF_BASKETBALL_OVERRIDES_KEY]));mfBasketballMarkBackupKeyRecognized(summary);}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}}
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_PROPOSAL_KEY)){summary.hasBasketballProposal=true;try{summary.basketballProposalStatus=mfBasketballValidateBackupProposal(backup.data[MF_BASKETBALL_PROPOSAL_KEY]).status;mfBasketballMarkBackupKeyRecognized(summary);}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}}
    return summary;
  };
}
if(typeof p8492FormatSummaryLines==="function"){
  const mfBasketballLegacyFormatSummaryLines=p8492FormatSummaryLines;
  p8492FormatSummaryLines=function(summary){const lines=mfBasketballLegacyFormatSummaryLines(summary),counts=summary.basketballOverrideCounts||{},index=Math.max(0,lines.findIndex(function(line){return /^Approx size:/.test(line);}));lines.splice(index,0,"Basketball sessions: "+(summary.hasBasketballSessions?summary.basketballSessionCount:"not included"),"Basketball program: "+(summary.hasBasketballProgramState?(summary.basketballProgramName||"no active program")+(summary.basketballNextSession?" · Next: "+summary.basketballNextSession:""):"not included"),"Basketball personalization: "+(summary.hasBasketballOverrides?(counts.modified+counts.added+counts.disabled)+" drill override(s), "+counts.reordered+" reordered session(s)":"not included"),"Basketball proposal: "+(summary.hasBasketballProposal?summary.basketballProposalStatus:"not included"));return lines;};
}
if(typeof p8ValidateBackup==="function"){
  const mfBasketballLegacyValidateBackup=p8ValidateBackup;
  p8ValidateBackup=function(raw){const backup=mfBasketballLegacyValidateBackup(raw);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_STORAGE_KEY))mfBasketballValidateBackupStore(backup.data[MF_BASKETBALL_STORAGE_KEY]);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_PROGRAM_STATE_KEY))mfBasketballValidateBackupProgramState(backup.data[MF_BASKETBALL_PROGRAM_STATE_KEY]);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_OVERRIDES_KEY))mfBasketballValidateBackupOverrides(backup.data[MF_BASKETBALL_OVERRIDES_KEY]);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_PROPOSAL_KEY))mfBasketballValidateBackupProposal(backup.data[MF_BASKETBALL_PROPOSAL_KEY]);return backup;};
}

// Late wrappers preserve all earlier History, Stats, navigation, and export behavior.
if(typeof p7CalcAnalytics==="function"){
  const mfBasketballLegacyCalcAnalytics=p7CalcAnalytics;p7CalcAnalytics=function(){const result=mfBasketballLegacyCalcAnalytics();if(!result||!result.trainingLoad)return result;const range=result.range||{start:null,end:null},allSessions=mfBasketballReadStore().sessions,sessions=allSessions.filter(function(session){return (!range.start||session.date>=range.start)&&(!range.end||session.date<=range.end);});result.trainingLoad.basketballSessions=sessions.length;result.trainingLoad.basketballMinutes=sessions.reduce(function(sum,session){return sum+(Number(session.minutes)||0);},0);result.activeCalories=mfBasketballCollectActiveCalories(range,allSessions);return result;};
}
if(typeof p7ApplyFilters==="function"){
  const mfBasketballLegacyApplyFilters=p7ApplyFilters;p7ApplyFilters=function(){const result=mfBasketballLegacyApplyFilters();mfBasketballRenderHistory();return result;};
}
if(typeof p7RenderAnalytics==="function"){
  const mfBasketballLegacyRenderAnalytics=p7RenderAnalytics;p7RenderAnalytics=function(){const result=mfBasketballLegacyRenderAnalytics();mfBasketballRenderStats();return result;};
}
if(typeof updateTrackerDate==="function"){
  const mfBasketballLegacyUpdateTrackerDate=updateTrackerDate;updateTrackerDate=function(){const result=mfBasketballLegacyUpdateTrackerDate();if(!mfBasketballEditingId)mfBasketballSetFormValue("mfBasketballDate",mfBasketballSelectedAppDate());mfBasketballUpdateBadge();return result;};
}
if(typeof showScreen==="function"){
  const mfBasketballLegacyShowScreen=showScreen;showScreen=function(name){const result=mfBasketballLegacyShowScreen(name);if(name==="history")mfBasketballRenderHistory();if(name==="analytics")mfBasketballRenderStats();if(name==="log")mfBasketballUpdateBadge();if(typeof p950ApplyTrackingPreferencesToUi==="function")p950ApplyTrackingPreferencesToUi();return result;};
}
if(typeof genExport==="function"){
  const mfBasketballLegacyGenExport=genExport;genExport=function(){
    const result=mfBasketballLegacyGenExport(),rangeEl=document.getElementById("exportRangeSelect"),section=mfBasketballBuildExport(rangeEl?rangeEl.value:"",mfBasketballReadStore().sessions,mfBasketballReadProgramState());
    if(typeof window._exp==="string"){
      const cross=mf105BuildCrossDomainExport(window.mf105ExportContext,rangeEl?rangeEl.value:"",mfBasketballReadStore().sessions,mfBasketballReadProgramState());
      window._exp=window._exp.replace("[[MF105_CROSS_DOMAIN]]",cross).replace("[[MF105_BASKETBALL]]",section||"--- BASKETBALL ---\nNo active program or sessions in this export range.\n\n").replace(/\[\[MF105_[A-Z_]+\]\]\n?/g,"");
      const output=document.getElementById("exportOut");if(output)output.textContent=window._exp;
    }
    return window._exp||result;
  };
}

// Final-load composition over the accepted habit extension hook. The function
// passed in is always the live authoritative core applySync binding from file 12.
let mfBasketballLegacySyncExtension=null;
function mfBasketballHandleSyncExtension(runCoreSync){
    const input=document.getElementById("syncInput"),res=document.getElementById("syncResult"),raw=input&&input.value||"",match=raw.match(/MARCUSFIT_UPDATE_START([\s\S]*?)MARCUSFIT_UPDATE_END/);
    if(!match)return false;
    const inner=match[1].trim().replace(/^```[a-zA-Z]*\n?/,"").replace(/\n?```$/,"").trim();let payload;
    try{payload=JSON.parse(inner);}catch(e){return mfBasketballLegacySyncExtension?mfBasketballLegacySyncExtension(runCoreSync):false;}
    if(payload&&!Array.isArray(payload)&&Object.keys(payload).some(function(key){return /tracking|profile/i.test(key); })){if(res){res.style.display="block";res.style.color="var(--red)";res.textContent="Sync rejected before any writes: Tracking Preferences are user-controlled and cannot be changed by AI Sync.";}return true;}
    if(payload&&!Array.isArray(payload)&&payload.habitProposal&&typeof p950IsTrackingEnabled==="function"&&!p950IsTrackingEnabled("modules.habits")){if(res){res.style.display="block";res.style.color="var(--red)";res.textContent="Sync rejected before any writes: Habit tracking is intentionally off. Re-enable it before importing a Habit proposal.";}return true;}
    if(payload&&!Array.isArray(payload)&&payload.basketballProposal&&typeof p950IsTrackingEnabled==="function"&&!p950IsTrackingEnabled("modules.basketball")){if(res){res.style.display="block";res.style.color="var(--red)";res.textContent="Sync rejected before any writes: Basketball tracking is intentionally off. Re-enable it before importing a Basketball proposal.";}return true;}
    if(!payload||Array.isArray(payload)||!payload.basketballProposal)return mfBasketballLegacySyncExtension?mfBasketballLegacySyncExtension(runCoreSync):false;
    const envelopeExtras=Object.keys(payload).filter(function(k){return !["updates","habitProposal","basketballProposal"].includes(k);});
    const envelopeError=envelopeExtras.length?"Mixed Sync payload contains unsupported top-level field(s): "+envelopeExtras.join(", ")+".":(Object.prototype.hasOwnProperty.call(payload,"updates")&&!Array.isArray(payload.updates)?"Mixed Sync updates must be an array.":"");
    if(envelopeError){if(res){res.style.display="block";res.style.color="var(--red)";res.textContent="Sync proposal import rejected before any proposal or core processing:\n"+envelopeError;}return true;}
    const basketballExisting=mfBasketballGetProposal(),basketballValidation=basketballExisting&&basketballExisting.status==="pending"?{valid:false,errors:["A basketball proposal is already pending. Review or dismiss it before importing another."]}:mfBasketballValidateProposal(payload.basketballProposal,{captureExpectedState:true});
    let habitValidation=null,habitExisting=null;
    if(payload.habitProposal&&typeof p960ValidateHabitProposal==="function"){
      habitExisting=typeof p960GetHabitProposal==="function"?p960GetHabitProposal():null;habitValidation=habitExisting&&habitExisting.status==="pending"?{valid:false,errors:["A habit proposal is already pending. Review or dismiss it before importing another."]}:p960ValidateHabitProposal(payload.habitProposal,null,{captureExpectedState:true});
    }
    const importErrors=[];if(!basketballValidation.valid)importErrors.push.apply(importErrors,basketballValidation.errors||["Basketball proposal is invalid."]);if(payload.habitProposal&&(!habitValidation||!habitValidation.valid))importErrors.push.apply(importErrors,habitValidation&&habitValidation.errors||["Habit proposal is invalid."]);
    if(importErrors.length){if(res){res.style.display="block";res.style.color="var(--red)";res.textContent="Sync proposal import rejected before any proposal or core processing:\n"+importErrors.join("\n");}return true;}
    const updates=Array.isArray(payload.updates)?payload.updates:[],habitBefore=localStorage.getItem("mf-habit-proposal"),basketballBefore=localStorage.getItem(MF_BASKETBALL_PROPOSAL_KEY);let coreMessage="";
    if(updates.length){try{input.value="MARCUSFIT_UPDATE_START\n"+JSON.stringify(updates,null,2)+"\nMARCUSFIT_UPDATE_END";runCoreSync();coreMessage=res&&res.textContent||"";}finally{input.value=raw;}}
    try{
      if(payload.habitProposal){const importedHabit=p960ImportHabitProposal(payload.habitProposal);if(!importedHabit.valid)throw new Error((importedHabit.errors||["Habit proposal import failed."]).join(" "));}
      const importedBasketball=mfBasketballImportProposal(payload.basketballProposal);if(!importedBasketball.valid)throw new Error((importedBasketball.errors||["Basketball proposal import failed."]).join(" "));
    }catch(e){mfBasketballRestoreRaw("mf-habit-proposal",habitBefore);mfBasketballRestoreRaw(MF_BASKETBALL_PROPOSAL_KEY,basketballBefore);if(res){res.style.display="block";res.style.color="var(--red)";res.textContent=(updates.length?"Core program sync completed, but proposal imports were rolled back together. ":"")+String(e.message||e);}return true;}
    if(res){const parts=[];if(updates.length)parts.push("Program sync processed.");if(payload.habitProposal)parts.push("Habit changes are pending explicit review.");parts.push(updates.length||payload.habitProposal?"Basketball changes are pending explicit review.":"Basketball proposal imported. Review required before any basketball program changes are applied.");res.style.display="block";res.style.color="var(--yellow)";res.textContent=parts.join(" ")+(coreMessage&&/skipped|error|rollback|invalid/i.test(coreMessage)?"\n\nCore Sync details:\n"+coreMessage:"");}
    mfBasketballRenderProposalStatus();mfBasketballOpenProposalReview();return true;
}
if(typeof p960HandleSyncExtension==="function"){
  mfBasketballLegacySyncExtension=p960HandleSyncExtension;
  p960HandleSyncExtension=mfBasketballHandleSyncExtension;
}

function mfBasketballDebug(){
  const state=mfBasketballReadStore(),programState=mfBasketballReadProgramState(),program=mfBasketballGetResolvedProgram(programState.state.activeProgramId,programState.state.activeProgramVersion),stats=mfBasketballAggregate(state.sessions),dates=state.sessions.map(function(session){return session.date;}).sort();
  return {appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:null,storageKey:MF_BASKETBALL_STORAGE_KEY,programStateKey:MF_BASKETBALL_PROGRAM_STATE_KEY,keyExists:state.keyExists,parseStatus:state.parseOk?"valid":"invalid",schemaVersion:state.schemaVersion,sessionCount:state.sessions.length,structuredSessionCount:stats.structuredSessions,invalidRecordCount:state.invalidRecordCount,totalMinutes:stats.totalMinutes,dateRange:dates.length?{first:dates[0],last:dates[dates.length-1]}:null,duplicateIds:state.duplicateIds.slice(),activeProgram:program?{id:program.id,version:program.version,name:program.name,nextSessionIndex:programState.state.nextSessionIndex,nextSessionId:program.sessions[programState.state.nextSessionIndex].id}:null,programStateParseStatus:programState.parseOk?"valid":"invalid",backupCoverage:{sessions:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_STORAGE_KEY):false,programState:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_PROGRAM_STATE_KEY):false,overrides:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_OVERRIDES_KEY):false,proposal:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_PROPOSAL_KEY):false},readOnly:true,error:state.error||programState.error};
}
window.mfBasketballDebug=mfBasketballDebug;

function mfBasketballOverridesDebug(){
  const parsed=mfBasketballReadOverrides(),counts=mfBasketballOverrideCounts(parsed.store),state=mfBasketballReadProgramState().state;return {schemaVersion:parsed.store.schemaVersion,keyExists:parsed.keyExists,parseStatus:parsed.parseOk?"valid":"invalid",activeProgram:state.activeProgramId,overrideProgramCount:counts.programs,modifiedDrillCount:counts.modified,addedDrillCount:counts.added,disabledDrillCount:counts.disabled,reorderedSessionCount:counts.reordered,expectedWriteKeys:[MF_BASKETBALL_OVERRIDES_KEY,MF_BASKETBALL_PROPOSAL_KEY,MF_BASKETBALL_PROGRAM_STATE_KEY],backupCoverage:typeof p8IsMarcusFitKey==="function"&&p8IsMarcusFitKey(MF_BASKETBALL_OVERRIDES_KEY),warnings:parsed.error?[parsed.error]:[],readOnly:true};
}

function mfBasketballProposalDebug(){
  const raw=localStorage.getItem(MF_BASKETBALL_PROPOSAL_KEY),proposal=mfBasketballGetProposal(),validation=proposal&&proposal.status==="pending"?mfBasketballValidateProposal(proposal):null,preview=proposal&&proposal.status==="pending"?mfBasketballApplyProposal(false):null;return {proposalExists:!!proposal,parseStatus:raw===null?"missing":proposal?"valid":"invalid",schemaVersion:proposal&&proposal.schemaVersion,proposalId:proposal&&proposal.proposalId,status:proposal&&proposal.status,actionCounts:proposal?proposal.changes.reduce(function(out,change){out[change.action]=(out[change.action]||0)+1;return out;},{}):{},validationErrors:validation?validation.errors:[],validationWarnings:validation?validation.warnings:(proposal&&proposal.validation&&proposal.validation.warnings)||[],conflicts:validation?validation.conflicts:[],undoAvailability:!!(proposal&&proposal.status==="applied"&&proposal.undoSnapshot),expectedWriteKeys:preview&&preview.expectedWrites||proposal&&proposal.applyState&&proposal.applyState.expectedWrites||[MF_BASKETBALL_PROPOSAL_KEY],backupCoverage:typeof p8IsMarcusFitKey==="function"&&p8IsMarcusFitKey(MF_BASKETBALL_PROPOSAL_KEY),readOnly:true};
}

function mfBasketballProposalSelfTest(){
  const keys=[MF_BASKETBALL_STORAGE_KEY,MF_BASKETBALL_PROGRAM_STATE_KEY,MF_BASKETBALL_OVERRIDES_KEY,MF_BASKETBALL_PROPOSAL_KEY],before={};keys.forEach(function(key){before[key]=localStorage.getItem(key);});const results=[];function check(name,passed){results.push({name:name,passed:!!passed});}
  try{
    mfBasketballRestoreRaw(MF_BASKETBALL_OVERRIDES_KEY,null);mfBasketballRestoreRaw(MF_BASKETBALL_PROPOSAL_KEY,null);mfBasketballSelectProgram("guard_skills_3_session","2026-08-28T12:00:00.000Z");const historyBefore=localStorage.getItem(MF_BASKETBALL_STORAGE_KEY),proposal={schemaVersion:1,proposalVersion:1,proposalId:"bball-proposal-self-test-1",summary:"Self-test target",rationale:"Read-only diagnostic transaction.",changes:[{action:"modify_drill",programId:"guard_skills_3_session",programVersion:1,sessionId:"guard_a_handle_weak_hand",drillId:"guard_behind_back_foundation",fields:{target:{durationMinutes:10}}}]};
    check("import",mfBasketballImportProposal(proposal,"2026-08-28T12:01:00.000Z").valid);check("preview is write-free",mfBasketballApplyProposal(false).requiresConfirmation&&localStorage.getItem(MF_BASKETBALL_OVERRIDES_KEY)===null);check("apply",mfBasketballApplyProposal(true,"2026-08-28T12:02:00.000Z").applied);check("resolved target",mfBasketballGetResolvedProgram("guard_skills_3_session",1).sessions[0].drills.find(function(drill){return drill.id==="guard_behind_back_foundation";}).target.durationMinutes===10);check("history unchanged",localStorage.getItem(MF_BASKETBALL_STORAGE_KEY)===historyBefore);check("undo",mfBasketballUndoProposal(true,"2026-08-28T12:03:00.000Z").undone&&localStorage.getItem(MF_BASKETBALL_OVERRIDES_KEY)===null);
    proposal.proposalId="bball-proposal-self-test-2";check("second import",mfBasketballImportProposal(proposal,"2026-08-28T12:04:00.000Z").valid);check("second apply",mfBasketballApplyProposal(true,"2026-08-28T12:05:00.000Z").applied);const changed=mfBasketballReadOverrides().store;changed.updatedAt="2026-08-28T12:06:00.000Z";localStorage.setItem(MF_BASKETBALL_OVERRIDES_KEY,JSON.stringify(changed));check("unsafe undo refused",mfBasketballUndoProposal(true).conflict===true);
  }catch(e){results.push({name:"unexpected error",passed:false,error:String(e&&e.message||e)});}finally{keys.forEach(function(key){mfBasketballRestoreRaw(key,before[key]);});mfBasketballRenderProgramSurface();mfBasketballRenderProposalStatus();}
  check("stores restored byte-for-byte",keys.every(function(key){return localStorage.getItem(key)===before[key];}));return {passed:results.every(function(result){return result.passed;}),results:results,restored:true,readOnlyAfterCompletion:true};
}

window.mfBasketballOverridesDebug=mfBasketballOverridesDebug;
window.mfBasketballProposalDebug=mfBasketballProposalDebug;
window.mfBasketballProposalSelfTest=mfBasketballProposalSelfTest;

// Dependency-free Node tests receive pure primitives without expanding the
// production browser's public/global surface.
if(typeof process!=="undefined"&&process&&process.versions&&process.versions.node){
  window["__mfBasketballTest"]={
    mfBasketballReadStore:mfBasketballReadStore,
    mfBasketballCreateId:mfBasketballCreateId,
    mfBasketballNormalizeSession:mfBasketballNormalizeSession,
    mfBasketballSaveSession:mfBasketballSaveSession,
    mfBasketballDeleteSession:mfBasketballDeleteSession,
    mfBasketballAggregate:mfBasketballAggregate,
    mfBasketballBuildExport:mfBasketballBuildExport,
    mfBasketballCollectActiveCalories:mfBasketballCollectActiveCalories,
    mfBasketballPrescriptions:MF_BASKETBALL_PRESCRIPTIONS,
    mfBasketballPrescriptionFor:mfBasketballPrescriptionFor,
    mfBasketballPrograms:MF_BASKETBALL_PROGRAMS,
    mfBasketballTrackingModes:MF_BASKETBALL_TRACKING_MODES,
    mfBasketballGetProgram:mfBasketballGetProgram,
    mfBasketballParseProgramStateValue:mfBasketballParseProgramStateValue,
    mfBasketballReadProgramState:mfBasketballReadProgramState,
    mfBasketballSelectProgram:mfBasketballSelectProgram,
    mfBasketballAdvanceProgramState:mfBasketballAdvanceProgramState,
    mfBasketballRestartProgram:mfBasketballRestartProgram,
    mfBasketballBuildStructuredInput:mfBasketballBuildStructuredInput,
    mfBasketballFinishStructuredSession:mfBasketballFinishStructuredSession,
    mfBasketballNormalizeDrillResult:mfBasketballNormalizeDrillResult,
    mfBasketballDrillHistory:mfBasketballDrillHistory,
    mfBasketballProgressionForDrill:mfBasketballProgressionForDrill,
    mfBasketballSessionPlannedMinutes:mfBasketballSessionPlannedMinutes,
    mfBasketballTrackingLabel:mfBasketballTrackingLabel,
    mfBasketballHistoryThroughSession:mfBasketballHistoryThroughSession,
    mfBasketballRenderProgramSurface:mfBasketballRenderProgramSurface,
    mfBasketballRenderHistory:mfBasketballRenderHistory,
    mfBasketballValidateBackupProgramState:mfBasketballValidateBackupProgramState,
    mfBasketballDefaultOverrides:mfBasketballDefaultOverrides,
    mfBasketballParseOverridesValue:mfBasketballParseOverridesValue,
    mfBasketballReadOverrides:mfBasketballReadOverrides,
    mfBasketballGetResolvedProgram:mfBasketballGetResolvedProgram,
    mfBasketballValidateTarget:mfBasketballValidateTarget,
    mfBasketballValidateProposal:mfBasketballValidateProposal,
    mfBasketballImportProposal:mfBasketballImportProposal,
    mfBasketballGetProposal:mfBasketballGetProposal,
    mfBasketballApplyProposal:mfBasketballApplyProposal,
    mfBasketballUndoProposal:mfBasketballUndoProposal,
    mfBasketballRejectProposal:mfBasketballRejectProposal,
    mfBasketballValidateBackupOverrides:mfBasketballValidateBackupOverrides,
    mfBasketballValidateBackupProposal:mfBasketballValidateBackupProposal,
    mfBasketballFingerprint:mfBasketballFingerprint,
    mfBasketballHandleSyncExtension:mfBasketballHandleSyncExtension,
    mfBasketballOpenProposalReview:mfBasketballOpenProposalReview,
    mfBasketballCloseProposalReview:mfBasketballCloseProposalReview,
    mfBasketballLockProposalScroll:mfBasketballLockProposalScroll,
    mfBasketballUnlockProposalScroll:mfBasketballUnlockProposalScroll
  };
}

function mfBasketballInit(){
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel"),deleteConfirm=document.getElementById("mfBasketballDeleteConfirm"),deleteCancel=document.getElementById("mfBasketballDeleteCancel"),dialog=document.getElementById("mfBasketballDeleteDialog"),programSelect=document.getElementById("mfBasketballProgramSelectButton"),viewProgram=document.getElementById("mfBasketballViewProgram"),reviewHistory=document.getElementById("mfBasketballReviewHistory"),restart=document.getElementById("mfBasketballRestartProgram"),programConfirm=document.getElementById("mfBasketballProgramDialogConfirm"),programCancel=document.getElementById("mfBasketballProgramDialogCancel"),programDialog=document.getElementById("mfBasketballProgramDialog"),closeStructured=document.getElementById("mfBasketballCloseStructured"),finishAdvance=document.getElementById("mfBasketballFinishAdvance"),finishRepeat=document.getElementById("mfBasketballFinishRepeat");
  if(save)save.addEventListener("click",mfBasketballSaveFromUI);if(cancel)cancel.addEventListener("click",function(){mfBasketballResetForm();});if(deleteConfirm)deleteConfirm.addEventListener("click",mfBasketballConfirmDelete);if(deleteCancel)deleteCancel.addEventListener("click",mfBasketballCloseDelete);
  if(programSelect)programSelect.addEventListener("click",mfBasketballChooseProgramFromUI);if(viewProgram)viewProgram.addEventListener("click",mfBasketballToggleProgramView);if(reviewHistory)reviewHistory.addEventListener("click",mfBasketballReviewHistory);if(restart)restart.addEventListener("click",function(){mfBasketballOpenProgramDialog({kind:"restart"});});if(programConfirm)programConfirm.addEventListener("click",mfBasketballConfirmProgramAction);if(programCancel)programCancel.addEventListener("click",mfBasketballCloseProgramDialog);if(closeStructured)closeStructured.addEventListener("click",mfBasketballCloseStructured);if(finishAdvance)finishAdvance.addEventListener("click",function(){mfBasketballFinishFromUI("advance");});if(finishRepeat)finishRepeat.addEventListener("click",function(){mfBasketballFinishFromUI("repeat");});
  if(dialog)dialog.addEventListener("click",function(event){if(event.target===dialog)mfBasketballCloseDelete();});
  if(programDialog)programDialog.addEventListener("click",function(event){if(event.target===programDialog)mfBasketballCloseProgramDialog();});
  if(document&&typeof document.addEventListener==="function")document.addEventListener("keydown",function(event){if(event.key!=="Escape")return;const proposalReview=document.getElementById("mfBasketballProposalReview");if(proposalReview&&proposalReview.classList.contains("open"))mfBasketballCloseProposalReview();else if(mfBasketballPendingDeleteId)mfBasketballCloseDelete();else if(mfBasketballPendingProgramAction)mfBasketballCloseProgramDialog();});
  mfBasketballResetForm();mfBasketballRenderProgramSurface();mfBasketballRenderProposalStatus();mfBasketballRenderHistory();mfBasketballRenderStats();
}

mfBasketballInit();
})();
