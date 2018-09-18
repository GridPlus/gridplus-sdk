pipeline {
  agent none

  options {
    buildDiscarder(logRotator(numToKeepStr: '2'))
    disableConcurrentBuilds()
  }
  stages {
    // stage("notify") {
    //   agent any
    //   steps {
    //     slackSend(
    //       color: "info",
    //       message: "${env.JOB_NAME} started: ${env.RUN_DISPLAY_URL}"
    //     )
    //   }
    // }
    // stage("build-bcoin") {
    //   agent {
    //     label "build"
    //   }
    //   steps {
    //     script {
    //       repo = 'gridplus'
    //       container = 'bcoin'
    //       tag = getBuildVersion()
    //     }
    //     dockerLogin()
    //     sh "docker image build -t ${container} -f bcoin.Dockerfile ."
    //     dockerLogout()
    //   }
    // }
    // stage("release-bcoin") {
    //   agent {
    //     label "build"
    //   }
    //   steps {
    //     dockerRelease(repo,container,tag)
    //     dockerRelease(repo,container,'latest')
    //   }
    // }
    // stage("build") {
    //   agent {
    //     label "build"
    //   }
    //   steps {
    //     script {
    //       repo = 'gridplus'
    //       container = 'gridplus-sdk'
    //       tag = getBuildVersion()
    //     }
    //     withCredentials([string(
    //       credentialsId: "npm-token",
    //       variable: "NPM_TOKEN"
    //     )]) {
    //       dockerLogin()
    //       sh "docker image build -t ${container} -f Dockerfile --build-arg=NPM_TOKEN=${NPM_TOKEN} ."
    //       dockerLogout()
    //     }

    //   }
    // }
    // stage("release") {
    //   agent {
    //     label "build"
    //   }
    //   steps {
    //     dockerRelease(repo,container,tag)
    //     dockerRelease(repo,container,'latest')
    //   }
    // }
  }
  post {
    failure {
      slackSend(
        color: "danger",
        message: "${env.JOB_NAME} failed: ${env.RUN_DISPLAY_URL}"
      )
    }
    success {
      slackSend(
        color: "good",
        message: "${env.JOB_NAME} succeeded: ${env.RUN_DISPLAY_URL}"
      )
    }
  }
}
