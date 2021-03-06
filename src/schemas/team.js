import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: {
    type: String,
  },

  pokemons: {
    required: true,
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Pokemon",
  },
});

const Team = mongoose.model("Team", schema);

export default Team;
