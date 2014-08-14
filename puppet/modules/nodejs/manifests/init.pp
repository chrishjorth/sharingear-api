class nodejs {
	Exec { path => [ "/bin/", "/sbin/" , "/usr/bin/", "/usr/sbin/" ] }

	#We need to update apt-get before installing dependencies
	exec { 'first-apt-update':
		command => 'apt-get update',
	}

	package { ['git', 'curl', 'build-essential', 'python', 'libssl-dev']:
		ensure => 'installed',
		require => Exec['first-apt-update'],
	}

	exec { 'get-node-repo':
		command => 'add-apt-repository ppa:chris-lea/node.js',
		notify => Exec['update-apt-get'],
	}

	#Then we update a second time to get the new nodejs repo
	exec { 'update-apt-get':
		command => 'apt-get update',
		notify => Package['nodejs'],
	}

	package { 'nodejs':
		ensure => 'installed',
		provider => 'apt',
	}
}