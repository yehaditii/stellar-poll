#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Poll {
    pub creator: Address,
    pub question: String,
    pub options: Vec<String>,
    pub active: bool,
}

#[contracttype]
pub enum DataKey {
    VoteCount(u32),
    HasVoted(Address),
    Initialized,
    Admin,
    StatsContract,
    Option(u32),
    NextPollId,
    Poll(u32),
    PollVoteCount(u32, u32),
    PollHasVoted(u32, Address),
}

#[contracttype]
pub enum StatsDataKey {
    PollTotalVotes(u32),
}

#[contract]
pub struct PollContract;

#[contract]
pub struct PollStatsContract;

#[contractimpl]
impl PollStatsContract {
    pub fn record_vote(env: Env, poll_id: u32, _option_index: u32) {
        let count: u32 = env
            .storage()
            .instance()
            .get(&StatsDataKey::PollTotalVotes(poll_id))
            .unwrap_or(0);

        env.storage()
            .instance()
            .set(&StatsDataKey::PollTotalVotes(poll_id), &(count + 1));
    }

    pub fn get_total_votes(env: Env, poll_id: u32) -> u32 {
        env.storage()
            .instance()
            .get(&StatsDataKey::PollTotalVotes(poll_id))
            .unwrap_or(0)
    }
}

#[contractimpl]
impl PollContract {
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Initialized, &true);

        // Initialize vote counts
        env.storage().instance().set(&DataKey::VoteCount(0), &0u32);
        env.storage().instance().set(&DataKey::VoteCount(1), &0u32);
        env.storage().instance().set(&DataKey::VoteCount(2), &0u32);

        // Store option names
        env.storage().instance().set(&DataKey::Option(0), &Symbol::new(&env, "Stellar"));
        env.storage().instance().set(&DataKey::Option(1), &Symbol::new(&env, "Ethereum"));
        env.storage().instance().set(&DataKey::Option(2), &Symbol::new(&env, "Solana"));
    }

    pub fn vote(env: Env, voter: Address, option_index: u32) {
        voter.require_auth();

        if option_index > 2 {
            panic!("invalid option");
        }

        let has_voted: bool = env
            .storage()
            .instance()
            .get(&DataKey::HasVoted(voter.clone()))
            .unwrap_or(false);

        if has_voted {
            panic!("already voted");
        }

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::VoteCount(option_index))
            .unwrap_or(0);

        env.storage()
            .instance()
            .set(&DataKey::VoteCount(option_index), &(count + 1));

        env.storage()
            .instance()
            .set(&DataKey::HasVoted(voter.clone()), &true);

        env.events()
            .publish((Symbol::new(&env, "vote"), voter.clone()), option_index);
    }

    pub fn get_votes(env: Env, option_index: u32) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::VoteCount(option_index))
            .unwrap_or(0)
    }

    pub fn get_option(env: Env, option_index: u32) -> Symbol {
        env.storage()
            .instance()
            .get(&DataKey::Option(option_index))
            .unwrap()
    }

    pub fn has_voted(env: Env, voter: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::HasVoted(voter))
            .unwrap_or(false)
    }

    pub fn create_poll(
        env: Env,
        creator: Address,
        question: String,
        options: Vec<String>,
    ) -> u32 {
        creator.require_auth();

        let poll_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextPollId)
            .unwrap_or(0);

        let poll = Poll {
            creator: creator.clone(),
            question,
            options: options.clone(),
            active: true,
        };

        env.storage()
            .instance()
            .set(&DataKey::Poll(poll_id), &poll);
        env.storage()
            .instance()
            .set(&DataKey::NextPollId, &(poll_id + 1));

        for option_index in 0..options.len() {
            env.storage().instance().set(
                &DataKey::PollVoteCount(poll_id, option_index),
                &0u32,
            );
        }

        env.events().publish(
            (Symbol::new(&env, "poll_created"), poll_id),
            creator,
        );

        poll_id
    }

    pub fn get_poll(env: Env, poll_id: u32) -> Poll {
        env.storage()
            .instance()
            .get(&DataKey::Poll(poll_id))
            .unwrap_or_else(|| panic!("poll not found"))
    }

    pub fn vote_poll(env: Env, poll_id: u32, voter: Address, option_index: u32) {
        voter.require_auth();

        let poll = Self::get_poll(env.clone(), poll_id);

        if !poll.active {
            panic!("poll is closed");
        }

        if option_index >= poll.options.len() {
            panic!("invalid option");
        }

        if env
            .storage()
            .instance()
            .get(&DataKey::PollHasVoted(poll_id, voter.clone()))
            .unwrap_or(false)
        {
            panic!("already voted");
        }

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PollVoteCount(poll_id, option_index))
            .unwrap_or(0);

        env.storage().instance().set(
            &DataKey::PollVoteCount(poll_id, option_index),
            &(count + 1),
        );
        env.storage()
            .instance()
            .set(&DataKey::PollHasVoted(poll_id, voter.clone()), &true);

        env.events().publish(
            (Symbol::new(&env, "vote"), poll_id, voter),
            option_index,
        );

        if let Some(stats_contract) = Self::get_stats_contract(env.clone()) {
            let stats_client = PollStatsContractClient::new(&env, &stats_contract);
            stats_client.record_vote(&poll_id, &option_index);
        }
    }

    pub fn close_poll(env: Env, poll_id: u32) {
        let mut poll = Self::get_poll(env.clone(), poll_id);

        poll.creator.require_auth();

        poll.active = false;
        env.storage()
            .instance()
            .set(&DataKey::Poll(poll_id), &poll);

        env.events().publish(
            (Symbol::new(&env, "poll_closed"), poll_id),
            poll.creator,
        );
    }

    pub fn get_poll_votes(env: Env, poll_id: u32, option_index: u32) -> u32 {
        let poll = Self::get_poll(env.clone(), poll_id);

        if option_index >= poll.options.len() {
            panic!("invalid option");
        }

        env.storage()
            .instance()
            .get(&DataKey::PollVoteCount(poll_id, option_index))
            .unwrap_or(0)
    }

    pub fn has_voted_in_poll(env: Env, poll_id: u32, voter: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::PollHasVoted(poll_id, voter))
            .unwrap_or(false)
    }

    pub fn set_stats_contract(env: Env, admin: Address, stats_contract: Address) {
        admin.require_auth();

        let configured_admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
        if let Some(configured_admin) = configured_admin {
            if configured_admin != admin {
                panic!("unauthorized admin");
            }
        } else {
            env.storage()
                .instance()
                .set(&DataKey::Admin, &admin.clone());
        }

        env.storage()
            .instance()
            .set(&DataKey::StatsContract, &stats_contract);
    }

    pub fn get_stats_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::StatsContract)
    }
}
#[cfg(test)]
mod test {
    use super::*;

    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        Address, TryIntoVal,
    };

    fn setup() -> (Env, PollContractClient<'static>, Address) {
        let env = Env::default();

        let contract_id = env.register_contract(None, PollContract);
        let client = PollContractClient::new(&env, &contract_id);

        let voter = Address::generate(&env);

        (env, client, voter)
    }

    #[test]
    fn test_initialize() {
        let (env, client, _) = setup();

        client.initialize();

        assert_eq!(client.get_votes(&0), 0);
        assert_eq!(client.get_votes(&1), 0);
        assert_eq!(client.get_votes(&2), 0);

        assert_eq!(client.get_option(&0), Symbol::new(&env, "Stellar"));
        assert_eq!(client.get_option(&1), Symbol::new(&env, "Ethereum"));
        assert_eq!(client.get_option(&2), Symbol::new(&env, "Solana"));
    }

    #[test]
    fn test_vote() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &0);

        assert_eq!(client.get_votes(&0), 1);
        assert!(client.has_voted(&voter));
    }

    #[test]
    fn test_vote_emits_event() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &0);

        let events = env.events().all();
        assert_eq!(events.len(), 1);

        let (_, topics, data) = events.get_unchecked(0);
        assert_eq!(topics.len(), 2);
        let topic: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
        let event_voter: Address = topics.get_unchecked(1).try_into_val(&env).unwrap();
        let option_index: u32 = data.try_into_val(&env).unwrap();

        assert_eq!(topic, Symbol::new(&env, "vote"));
        assert_eq!(event_voter, voter);
        assert_eq!(option_index, 0);
    }

    #[test]
    #[should_panic(expected = "already voted")]
    fn test_duplicate_vote_rejected() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &0);
        client.vote(&voter, &1);
    }

    #[test]
    #[should_panic(expected = "invalid option")]
    fn test_invalid_option_rejected() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &3);
    }

    #[test]
    fn test_multiple_voters() {
        let (env, client, voter1) = setup();

        let voter2 = Address::generate(&env);

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter1, &0);
        client.vote(&voter2, &0);

        assert_eq!(client.get_votes(&0), 2);
        assert!(client.has_voted(&voter1));
        assert!(client.has_voted(&voter2));
    }

    fn poll_options(env: &Env) -> Vec<String> {
        Vec::from_array(
            env,
            [
                String::from_str(env, "Stellar"),
                String::from_str(env, "Ethereum"),
            ],
        )
    }

    #[test]
    fn test_create_poll() {
        let (env, client, creator) = setup();

        env.mock_all_auths();

        assert_eq!(
            client.create_poll(
                &creator,
                &String::from_str(&env, "Which network do you prefer?"),
                &poll_options(&env),
            ),
            0
        );
    }

    #[test]
    fn test_get_poll() {
        let (env, client, creator) = setup();
        let options = poll_options(&env);

        env.mock_all_auths();

        client.create_poll(
            &creator,
            &String::from_str(&env, "Which network do you prefer?"),
            &options,
        );

        let poll = client.get_poll(&0);
        assert_eq!(poll.creator, creator);
        assert_eq!(poll.question, String::from_str(&env, "Which network do you prefer?"));
        assert_eq!(poll.options, options);
        assert!(poll.active);
    }

    #[test]
    fn test_vote_poll() {
        let (env, client, creator) = setup();
        let voter = Address::generate(&env);

        env.mock_all_auths();

        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &voter, &1);

        assert_eq!(client.get_poll_votes(&0, &1), 1);
        assert!(client.has_voted_in_poll(&0, &voter));
    }

    #[test]
    #[should_panic(expected = "already voted")]
    fn test_duplicate_poll_vote_rejected() {
        let (env, client, creator) = setup();
        let voter = Address::generate(&env);

        env.mock_all_auths();

        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &voter, &0);
        client.vote_poll(&0, &voter, &1);
    }

    #[test]
    #[should_panic(expected = "invalid option")]
    fn test_invalid_poll_option_rejected() {
        let (env, client, creator) = setup();

        env.mock_all_auths();

        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &creator, &2);
    }

    #[test]
    fn test_close_poll() {
        let (env, client, creator) = setup();

        env.mock_all_auths();

        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.close_poll(&0);

        assert!(!client.get_poll(&0).active);
    }

    #[test]
    #[should_panic(expected = "poll is closed")]
    fn test_vote_after_poll_closure_rejected() {
        let (env, client, creator) = setup();
        let voter = Address::generate(&env);

        env.mock_all_auths();

        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.close_poll(&0);
        client.vote_poll(&0, &voter, &0);
    }

    #[test]
    #[should_panic]
    fn test_unauthorized_poll_closure_rejected() {
        let (env, client, creator) = setup();

        env.mock_all_auths();
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );

        env.set_auths(&[]);
        client.close_poll(&0);
    }

    #[test]
    fn test_different_voters_can_vote_in_poll() {
        let (env, client, creator) = setup();
        let voter2 = Address::generate(&env);

        env.mock_all_auths();
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &creator, &0);
        client.vote_poll(&0, &voter2, &0);

        assert_eq!(client.get_poll_votes(&0, &0), 2);
    }

    #[test]
    fn test_poll_created_event() {
        let (env, client, creator) = setup();

        env.mock_all_auths();
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );

        let events = env.events().all();
        assert_eq!(events.len(), 1);
        let (_, topics, data) = events.get_unchecked(0);
        let topic: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
        let poll_id: u32 = topics.get_unchecked(1).try_into_val(&env).unwrap();
        let event_creator: Address = data.try_into_val(&env).unwrap();

        assert_eq!(topic, Symbol::new(&env, "poll_created"));
        assert_eq!(poll_id, 0);
        assert_eq!(event_creator, creator);
    }

    #[test]
    fn test_poll_closed_event() {
        let (env, client, creator) = setup();

        env.mock_all_auths();
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.close_poll(&0);

        let events = env.events().all();
        assert_eq!(events.len(), 2);
        let (_, topics, data) = events.get_unchecked(1);
        let topic: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
        let poll_id: u32 = topics.get_unchecked(1).try_into_val(&env).unwrap();
        let event_creator: Address = data.try_into_val(&env).unwrap();

        assert_eq!(topic, Symbol::new(&env, "poll_closed"));
        assert_eq!(poll_id, 0);
        assert_eq!(event_creator, creator);
    }

    fn setup_with_stats() -> (
        Env,
        PollContractClient<'static>,
        PollStatsContractClient<'static>,
        Address,
    ) {
        let env = Env::default();
        let poll_id = env.register_contract(None, PollContract);
        let stats_id = env.register_contract(None, PollStatsContract);
        let poll_client = PollContractClient::new(&env, &poll_id);
        let stats_client = PollStatsContractClient::new(&env, &stats_id);
        let creator = Address::generate(&env);

        (env, poll_client, stats_client, creator)
    }

    #[test]
    fn test_stats_contract_starts_with_zero_votes() {
        let (env, _, stats_client, _) = setup_with_stats();

        assert_eq!(stats_client.get_total_votes(&0), 0);
        assert_eq!(stats_client.get_total_votes(&1), 0);
        let _ = env;
    }

    #[test]
    fn test_stats_contract_can_record_vote() {
        let (env, _, stats_client, _) = setup_with_stats();

        stats_client.record_vote(&0, &1);

        assert_eq!(stats_client.get_total_votes(&0), 1);
        let _ = env;
    }

    #[test]
    fn test_poll_configures_stats_contract() {
        let (env, client, stats_client, creator) = setup_with_stats();

        env.mock_all_auths();
        client.set_stats_contract(&creator, &stats_client.address);

        assert_eq!(client.get_stats_contract(), Some(stats_client.address.clone()));
    }

    #[test]
    fn test_vote_poll_updates_stats_total() {
        let (env, client, stats_client, creator) = setup_with_stats();
        let voter = Address::generate(&env);

        env.mock_all_auths();
        client.set_stats_contract(&creator, &stats_client.address);
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &voter, &0);

        assert_eq!(stats_client.get_total_votes(&0), 1);
    }

    #[test]
    fn test_multiple_votes_update_stats_total() {
        let (env, client, stats_client, creator) = setup_with_stats();
        let voter2 = Address::generate(&env);

        env.mock_all_auths();
        client.set_stats_contract(&creator, &stats_client.address);
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &creator, &0);
        client.vote_poll(&0, &voter2, &1);

        assert_eq!(stats_client.get_total_votes(&0), 2);
    }

    #[test]
    fn test_stats_totals_are_separate_per_poll() {
        let (env, client, stats_client, creator) = setup_with_stats();
        let voter2 = Address::generate(&env);

        env.mock_all_auths();
        client.set_stats_contract(&creator, &stats_client.address);
        client.create_poll(
            &creator,
            &String::from_str(&env, "First poll"),
            &poll_options(&env),
        );
        client.create_poll(
            &creator,
            &String::from_str(&env, "Second poll"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &creator, &0);
        client.vote_poll(&1, &voter2, &0);

        assert_eq!(stats_client.get_total_votes(&0), 1);
        assert_eq!(stats_client.get_total_votes(&1), 1);
    }

    #[test]
    fn test_vote_poll_works_without_stats_contract() {
        let (env, client, creator) = setup();

        env.mock_all_auths();
        client.create_poll(
            &creator,
            &String::from_str(&env, "Choose one"),
            &poll_options(&env),
        );
        client.vote_poll(&0, &creator, &0);

        assert_eq!(client.get_poll_votes(&0, &0), 1);
        assert_eq!(client.get_stats_contract(), None);
    }

    #[test]
    #[should_panic(expected = "unauthorized admin")]
    fn test_unauthorized_stats_contract_configuration_rejected() {
        let (env, client, stats_client, creator) = setup_with_stats();
        let other = Address::generate(&env);

        env.mock_all_auths();
        client.set_stats_contract(&creator, &stats_client.address);
        client.set_stats_contract(&other, &stats_client.address);
    }
}